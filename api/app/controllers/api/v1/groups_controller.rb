module Api
  module V1
    class GroupsController < BaseController
      before_action :authorize_collection_tournament_access!, only: [:index, :create, :batch_create, :auto_assign, :place_golfer]
      before_action :authorize_group_access!, only: [:show, :update, :destroy, :set_hole, :add_golfer, :remove_golfer]
      before_action :authorize_update_positions_access!, only: [:update_positions]

      # GET /api/v1/groups
      def index
        tournament = find_tournament
        return render_tournament_required unless tournament

        groups = preload_group_position_letters(tournament.groups.with_golfers)

        render json: groups, each_serializer: GroupSerializer, include: "golfers"
      end

      # GET /api/v1/groups/:id
      def show
        group = Group.includes(:golfers).find(params[:id])
        render json: group, include: "golfers"
      end

      # POST /api/v1/groups
      def create
        tournament = find_tournament
        return render_tournament_required unless tournament

        # Auto-assign next group number for this tournament
        next_number = (tournament.groups.maximum(:group_number) || 0) + 1
        group = tournament.groups.new(
          group_number: next_number,
          starting_course_key: params[:starting_course_key],
          hole_number: params[:hole_number]
        )

        if group.save
          ActivityLog.log(
            admin: current_admin,
            action: 'group_created',
            target: group,
            details: "Created #{starting_position_reference(group)}",
            metadata: group_metadata(group)
          )
          broadcast_groups_update(tournament)
          render json: group, status: :created
        else
          render json: { errors: group.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/groups/:id
      def update
        group = Group.find(params[:id])
        old_label = group.starting_position_label

        if group.update(group_params)
          if old_label != group.starting_position_label
            ActivityLog.log(
              admin: current_admin,
              action: 'group_updated',
              target: group,
              details: "Updated starting position to #{starting_position_reference(group)} (was #{old_label || 'Unassigned'})",
              metadata: group_metadata(group).merge(previous_label: old_label)
            )
          end
          broadcast_groups_update(group.tournament)
          render json: group, include: "golfers"
        else
          render json: { errors: group.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/groups/:id
      def destroy
        group = Group.find(params[:id])
        tournament = group.tournament
        group_number = group.group_number
        golfer_names = group.golfers.pluck(:name)

        hole_label = group.starting_position_label

        ActiveRecord::Base.transaction do
          group.golfers.update_all(group_id: nil, position: nil)
          group.scores.destroy_all
          group.destroy!
        end
        
        ActivityLog.log(
          admin: current_admin,
          action: 'group_deleted',
          target: nil,
          tournament: tournament,
          details: "Deleted #{starting_position_reference(group, label: hole_label)}",
          metadata: group_metadata(group).merge(
            group_number: group_number,
            starting_position_label: hole_label,
            hole_label: hole_label,
            removed_golfers: golfer_names
          )
        )
        
        broadcast_groups_update(tournament)
        head :no_content
      end

      # POST /api/v1/groups/:id/set_hole
      def set_hole
        group = Group.find(params[:id])
        old_label = group.starting_position_label
        attributes, error_message = starting_position_params_for(group.tournament)

        if error_message
          render json: { error: error_message }, status: :unprocessable_entity
          return
        end

        if group.update(attributes)
          ActivityLog.log(
            admin: current_admin,
            action: 'group_updated',
            target: group,
            details: group.assigned_start? ? "Assigned to #{group.starting_position_label}" : "Cleared starting position",
            metadata: group_metadata(group).merge(previous_label: old_label)
          )
          broadcast_groups_update(group.tournament)
          render json: group, include: "golfers"
        else
          render json: { errors: group.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/groups/:id/add_golfer
      def add_golfer
        group = Group.find(params[:id])
        golfer = Golfer.find(params[:golfer_id])

        if golfer.tournament_id != group.tournament_id
          render json: { error: "Golfer and group must belong to the same tournament" }, status: :unprocessable_entity
          return
        end

        unless group.can_add?(golfer)
          render json: { error: "Group is full (#{group.player_count}/#{group.max_golfers} players)" }, status: :unprocessable_entity
          return
        end
        
        # Prevent adding cancelled or waitlist golfers to groups
        if golfer.registration_status == "cancelled"
          render json: { error: "Cannot add cancelled golfer to a group" }, status: :unprocessable_entity
          return
        end
        
        if golfer.registration_status == "waitlist"
          render json: { error: "Cannot add waitlist golfer to a group. Promote them to confirmed first." }, status: :unprocessable_entity
          return
        end

        if group.add_golfer(golfer)
          ActivityLog.log(
            admin: current_admin,
            action: 'golfer_assigned_to_group',
            target: golfer,
            details: "Added #{golfer.name} to #{starting_position_reference(group)}",
            metadata: group_metadata(group).merge(
              group_id: group.id,
              group_number: group.group_number
            )
          )
          broadcast_groups_update(group.tournament)
          render json: group, include: "golfers"
        else
          render json: { errors: golfer.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/groups/:id/remove_golfer
      def remove_golfer
        group = Group.find(params[:id])
        golfer = Golfer.find(params[:golfer_id])

        unless golfer.group_id == group.id
          render json: { error: "Golfer is not in this group" }, status: :unprocessable_entity
          return
        end

        hole_label = group.starting_position_label
        if group.remove_golfer(golfer)
          ActivityLog.log(
            admin: current_admin,
            action: 'golfer_removed_from_group',
            target: golfer,
            details: "Removed #{golfer.name} from #{starting_position_reference(group, label: hole_label)}",
            metadata: group_metadata(group).merge(
              group_id: group.id,
              group_number: group.group_number,
              starting_position_label: hole_label,
              hole_label: hole_label
            )
          )
          
          broadcast_groups_update(group.tournament)
          render json: group, include: "golfers"
        else
          render json: { errors: golfer.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/groups/update_positions
      # For drag-and-drop reordering
      def update_positions
        updates = params[:updates] || []
        tournament = nil

        ActiveRecord::Base.transaction do
          updates.each do |update|
            golfer = Golfer.find(update[:golfer_id])
            tournament ||= golfer.tournament

            golfer.update!(
              group_id: update[:group_id],
              position: update[:position]
            )
          end
        end

        broadcast_groups_update(tournament) if tournament
        render json: { message: "Positions updated successfully" }
      rescue ActiveRecord::RecordNotFound => e
        render json: { error: e.message }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/groups/place_golfer
      def place_golfer
        tournament = find_tournament
        return render_tournament_required unless tournament

        golfer = tournament.golfers.find(params[:golfer_id])
        if golfer.group_id.present?
          render json: { error: "Golfer is already assigned to a group" }, status: :unprocessable_entity
          return
        end

        if golfer.registration_status == "cancelled"
          render json: { error: "Cannot add cancelled golfer to a group" }, status: :unprocessable_entity
          return
        end

        if golfer.registration_status == "waitlist"
          render json: { error: "Cannot add waitlist golfer to a group. Promote them to confirmed first." }, status: :unprocessable_entity
          return
        end

        attributes, error_message = starting_position_params_for(tournament)
        if error_message
          render json: { error: error_message }, status: :unprocessable_entity
          return
        end

        group = nil

        ActiveRecord::Base.transaction do
          next_number = (tournament.groups.maximum(:group_number) || 0) + 1
          group = tournament.groups.create!(
            group_number: next_number,
            starting_course_key: attributes[:starting_course_key],
            hole_number: attributes[:hole_number]
          )

          unless group.add_golfer(golfer)
            raise ActiveRecord::RecordInvalid, golfer
          end

          ActivityLog.log(
            admin: current_admin,
            action: 'group_created',
            target: group,
            details: "Created #{starting_position_reference(group)}",
            metadata: group_metadata(group)
          )

          ActivityLog.log(
            admin: current_admin,
            action: 'golfer_assigned_to_group',
            target: golfer,
            details: "Added #{golfer.name} to #{starting_position_reference(group)}",
            metadata: group_metadata(group).merge(
              group_id: group.id,
              group_number: group.group_number
            )
          )
        end

        broadcast_groups_update(tournament)
        render json: group, include: "golfers", status: :created
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Golfer not found" }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/groups/batch_create
      # Create multiple groups at once
      def batch_create
        tournament = find_tournament
        return render_tournament_required unless tournament

        count = params[:count].to_i
        count = 1 if count < 1
        count = 40 if count > 40 # Max 40 groups (160 golfers / 4)

        groups = []
        next_number = (tournament.groups.maximum(:group_number) || 0) + 1

        count.times do |i|
          groups << tournament.groups.create!(group_number: next_number + i)
        end

        broadcast_groups_update(tournament)
        render json: groups, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/groups/auto_assign
      # Automatically assign unassigned golfers to groups
      def auto_assign
        tournament = find_tournament
        return render_tournament_required unless tournament

        unassigned = tournament.golfers.confirmed.unassigned.order(:created_at)

        if unassigned.empty?
          render json: { message: "No unassigned confirmed golfers" }
          return
        end

        assigned_count = 0
        failures = []

        unassigned.each do |golfer|
          group = tournament.groups.includes(:golfers)
                       .select { |g| g.can_add?(golfer) }
                       .first

          created_group = false
          unless group
            next_number = (tournament.groups.maximum(:group_number) || 0) + 1
            group = tournament.groups.create!(group_number: next_number)
            created_group = true
          end

          if group.add_golfer(golfer)
            assigned_count += 1
          else
            group.destroy if created_group && group.golfers.none?
            failures << auto_assign_failure_for(golfer)
          end
        end

        broadcast_groups_update(tournament)
        message =
          if failures.any?
            "Auto-assigned #{assigned_count} golfers; #{failures.length} could not be assigned"
          else
            "Auto-assigned #{assigned_count} golfers"
          end

        render json: {
          message: message,
          assigned_count: assigned_count,
          failed_count: failures.length,
          failures: failures
        }
      end

      private

      def auto_assign_failure_for(golfer)
        {
          golfer_id: golfer.id,
          name: golfer.name,
          errors: golfer.errors.full_messages.presence || ["Unable to auto-assign golfer"]
        }
      end

      def authorize_collection_tournament_access!
        tournament = find_tournament
        return render_tournament_required unless tournament

        require_tournament_admin!(tournament)
      end

      def authorize_group_access!
        group = Group.find(params[:id])
        require_tournament_admin!(group.tournament)
      end

      def authorize_update_positions_access!
        updates = params[:updates]
        unless updates.is_a?(Array) && updates.any?
          render json: { error: "updates must be a non-empty array" }, status: :unprocessable_entity
          return
        end

        first_update = updates.first
        golfer = Golfer.find_by(id: first_update[:golfer_id])
        unless golfer
          render json: { error: "Golfer not found" }, status: :not_found
          return
        end

        require_tournament_admin!(golfer.tournament)
      end

      def find_tournament
        if params[:tournament_id].present?
          Tournament.find(params[:tournament_id])
        else
          Tournament.current
        end
      end

      def render_tournament_required
        render json: { error: "Tournament not found or not specified" }, status: :not_found
      end

      def group_params
        params.require(:group).permit(:group_number, :starting_course_key, :hole_number)
      end

      def group_metadata(group)
        {
          starting_course_key: group.starting_course_key,
          hole_number: group.hole_number,
          group_number: group.group_number,
          starting_position_label: group.starting_position_label,
          hole_label: group.hole_position_label
        }
      end

      def starting_position_reference(group, label: nil)
        resolved = label.presence || group.starting_position_label
        return "Group #{group.group_number}" if resolved.blank? || resolved == "Unassigned"

        resolved
      end

      def starting_position_params_for(tournament)
        course_key = params[:starting_course_key].presence
        hole_number = params[:hole_number].presence&.to_i

        return [{ starting_course_key: nil, hole_number: nil }, nil] if course_key.blank? && hole_number.nil?
        return [nil, "Starting course and hole are both required"] if course_key.blank? || hole_number.nil?

        course = tournament.course_config_for(course_key)
        return [nil, "Selected course is not configured for this event"] unless course

        max_holes = course['hole_count'].to_i
        return [nil, "Hole number must be between 1 and #{max_holes} for #{course['name']}"] unless (1..max_holes).include?(hole_number)

        [{ starting_course_key: course_key, hole_number: hole_number }, nil]
      end

      def preload_group_position_letters(groups)
        Group.preload_position_letters(groups.to_a)
      end

      def broadcast_groups_update(tournament)
        return unless tournament
        
        groups = preload_group_position_letters(tournament.groups.with_golfers)
        ActionCable.server.broadcast("groups_channel", {
          action: "updated",
          tournament_id: tournament.id,
          groups: ActiveModelSerializers::SerializableResource.new(groups, each_serializer: GroupSerializer, include: "golfers").as_json
        })
      rescue StandardError => e
        Rails.logger.error("Failed to broadcast groups update: #{e.message}")
      end
    end
  end
end
