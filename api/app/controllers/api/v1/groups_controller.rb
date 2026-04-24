module Api
  module V1
    class GroupsController < BaseController
      class PlacementError < StandardError; end

      before_action :authorize_collection_tournament_access!, only: [:index, :create, :batch_create, :auto_assign, :place_golfer]
      before_action :authorize_group_access!, only: [:show, :update, :destroy, :set_hole, :add_golfer, :merge_into, :remove_golfer]
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

        group = nil

        ActiveRecord::Base.transaction do
          group = tournament.groups.new(
            group_number: allocate_next_group_number!(tournament),
            starting_course_key: params[:starting_course_key],
            hole_number: params[:hole_number]
          )

          group.save!
        end

        ActivityLog.log(
          admin: current_admin,
          action: 'group_created',
          target: group,
          details: "Created #{starting_position_reference(group)}",
          metadata: group_metadata(group)
        )
        broadcast_groups_update(tournament)
        render json: serialize_group_payload(group), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
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
          render json: serialize_group_payload(group)
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

        positions_to_track = [starting_position_key(group), starting_position_key_for_attributes(attributes)]
        removed_group_id = nil
        response_payload = nil
        deleted = false
        tournament = group.tournament
        label_changes = {}

        ActiveRecord::Base.transaction do
          label_changes = tracked_label_changes(tournament, positions_to_track)

          merge_target = nil
          if !placement_mode_new_pairing? &&
             attributes[:starting_course_key].present? &&
             attributes[:hole_number].present? &&
             group.golfers.any?
            merge_target = Group.available_slot_for(
              tournament: tournament,
              course_key: attributes[:starting_course_key],
              hole_number: attributes[:hole_number],
              incoming_players: group.player_count,
              exclude_group_id: group.id
            )

            if merge_target.nil? &&
               !Group.start_position_available?(
                 tournament: tournament,
                 course_key: attributes[:starting_course_key],
                 hole_number: attributes[:hole_number],
                 exclude_group_id: group.id
               )
              raise PlacementError, start_position_limit_error(
                tournament,
                attributes[:starting_course_key],
                attributes[:hole_number]
              )
            end
          end

          if merge_target
            merge_groups!(source_group: group, target_group: merge_target)
            removed_group_id = group.id
            response_payload = serialize_group_payload(merge_target).merge(
              removed_group_id: removed_group_id,
              merged: true
            )
          elsif !group.update(attributes)
            raise ActiveRecord::RecordInvalid, group
          end

          if !merge_target && !group.assigned_start? && group.empty_slot?
            removed_group_id = group.id
            group.scores.destroy_all
            group.destroy!
            deleted = true
            response_payload = { removed_group_id: removed_group_id, deleted: true }
          elsif !merge_target
            response_payload = serialize_group_payload(group)
          end
        end

        ActivityLog.log(
          admin: current_admin,
          action: 'group_updated',
          target: group,
          details: group.assigned_start? ? "Assigned to #{group.starting_position_label}" : "Cleared starting position",
          metadata: group_metadata(group).merge(previous_label: old_label)
        )
        log_starting_position_adjustments(
          tournament: tournament,
          positions: positions_to_track,
          previous_labels: label_changes,
          excluded_group_ids: [group.id]
        )
        broadcast_groups_update(tournament)
        render json: response_payload
      rescue PlacementError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/groups/:id/add_golfer
      def add_golfer
        group = nil
        golfer = nil

        ActiveRecord::Base.transaction do
          golfer = Golfer.lock.find(params[:golfer_id])
          group = Group.lock.includes(:golfers).find(params[:id])

          if golfer.tournament_id != group.tournament_id
            raise PlacementError, "Golfer and group must belong to the same tournament"
          end

          unless group.can_add?(golfer)
            raise PlacementError, "Group is full (#{group.player_count}/#{group.max_golfers} players)"
          end

          if golfer.registration_status == "cancelled"
            raise PlacementError, "Cannot add cancelled golfer to a group"
          end

          if golfer.registration_status == "waitlist"
            raise PlacementError, "Cannot add waitlist golfer to a group. Promote them to confirmed first."
          end

          if golfer.group_id.present?
            raise PlacementError, "Golfer is already assigned to a group"
          end

          unless group.add_golfer(golfer)
            raise ActiveRecord::RecordInvalid, golfer
          end
        end

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
        render json: serialize_group_payload(group)
      rescue PlacementError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/groups/:id/merge_into
      def merge_into
        source_group = nil
        target_group = nil
        tournament = nil
        positions_to_track = []
        label_changes = {}
        removed_group_id = nil

        ActiveRecord::Base.transaction do
          locked_groups = Group.lock.includes(:golfers).where(id: [params[:id], params[:target_group_id]]).order(:id).to_a
          source_group = locked_groups.find { |group| group.id == params[:id].to_i }
          target_group = locked_groups.find { |group| group.id == params[:target_group_id].to_i }

          raise ActiveRecord::RecordNotFound unless source_group && target_group
          raise PlacementError, "Source and target pairings must be different" if source_group.id == target_group.id
          raise PlacementError, "Groups must belong to the same tournament" if source_group.tournament_id != target_group.tournament_id
          raise PlacementError, "Source pairing has no teams to merge" if source_group.golfers.empty?

          incoming_players = source_group.player_count
          unless target_group.player_count + incoming_players <= target_group.max_golfers
            raise PlacementError, "Target pairing is full"
          end

          tournament = source_group.tournament
          positions_to_track = [starting_position_key(source_group), starting_position_key(target_group)]
          removed_group_id = source_group.id
          label_changes = tracked_label_changes(tournament, positions_to_track)
          merge_groups!(source_group: source_group, target_group: target_group)
        end

        log_starting_position_adjustments(
          tournament: tournament,
          positions: positions_to_track,
          previous_labels: label_changes,
          excluded_group_ids: [target_group.id]
        )
        broadcast_groups_update(tournament)

        render json: serialize_group_payload(target_group).merge(
          removed_group_id: removed_group_id,
          merged: true
        )
      rescue PlacementError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Group not found" }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/groups/:id/remove_golfer
      def remove_golfer
        group = nil
        golfer = nil

        hole_label = nil
        group_deleted = false
        removed_group_id = nil
        label_changes = {}
        tournament = nil

        ActiveRecord::Base.transaction do
          golfer = Golfer.lock.find(params[:golfer_id])
          group = Group.lock.find(params[:id])

          unless golfer.group_id == group.id
            raise PlacementError, "Golfer is not in this group"
          end

          hole_label = group.starting_position_label
          tournament = group.tournament
          label_changes = tracked_label_changes(tournament, [starting_position_key(group)])
          raise ActiveRecord::RecordInvalid, golfer unless group.remove_golfer(golfer)

          if group.empty_slot?
            removed_group_id = group.id
            group.scores.destroy_all
            group.destroy!
            group_deleted = true
          end
        end

        if golfer.errors.empty?
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
          if group_deleted
            log_starting_position_adjustments(
              tournament: tournament,
              positions: [starting_position_key(group)],
              previous_labels: label_changes
            )
          end
          
          broadcast_groups_update(tournament)
          if group_deleted
            render json: { removed_group_id: removed_group_id, deleted: true }
          else
            render json: serialize_group_payload(group)
          end
        else
          render json: { errors: golfer.errors.full_messages }, status: :unprocessable_entity
        end
      rescue PlacementError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Group or golfer not found" }, status: :not_found
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

        attributes, error_message = starting_position_params_for(tournament)
        if error_message
          render json: { error: error_message }, status: :unprocessable_entity
          return
        end

        group = nil
        created_group = false

        ActiveRecord::Base.transaction do
          golfer = tournament.golfers.lock.find(params[:golfer_id])

          raise PlacementError, "Golfer is already assigned to a group" if golfer.group_id.present?
          raise PlacementError, "Cannot add cancelled golfer to a group" if golfer.registration_status == "cancelled"
          if golfer.registration_status == "waitlist"
            raise PlacementError, "Cannot add waitlist golfer to a group. Promote them to confirmed first."
          end

          unless placement_mode_new_pairing?
            group = Group.available_slot_for(
              tournament: tournament,
              course_key: attributes[:starting_course_key],
              hole_number: attributes[:hole_number],
              incoming_players: golfer.partner_name.present? ? 2 : 1
            )
          end

          unless group
            unless Group.start_position_available?(
              tournament: tournament,
              course_key: attributes[:starting_course_key],
              hole_number: attributes[:hole_number]
            )
              raise PlacementError, start_position_limit_error(
                tournament,
                attributes[:starting_course_key],
                attributes[:hole_number]
              )
            end

            created_group = true
            group = tournament.groups.create!(
              group_number: allocate_next_group_number!(tournament),
              starting_course_key: attributes[:starting_course_key],
              hole_number: attributes[:hole_number]
            )
          end

          unless group.add_golfer(golfer)
            raise ActiveRecord::RecordInvalid, golfer
          end

          if created_group
            ActivityLog.log(
              admin: current_admin,
              action: 'group_created',
              target: group,
              details: "Created #{starting_position_reference(group)}",
              metadata: group_metadata(group)
            )
          end

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
        render json: serialize_group_payload(group), status: :created
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Golfer not found" }, status: :not_found
      rescue PlacementError => e
        render json: { error: e.message }, status: :unprocessable_entity
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

        ActiveRecord::Base.transaction do
          tournament.lock!
          next_number = (tournament.groups.maximum(:group_number) || 0) + 1

          count.times do |i|
            groups << tournament.groups.create!(group_number: next_number + i)
          end
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

        unassigned = tournament.golfers.where(registration_status: %w[confirmed pending]).unassigned.order(:created_at)

        if unassigned.empty?
          render json: { message: "No unassigned teams eligible for hole assignment" }
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
            group = ActiveRecord::Base.transaction do
              tournament.groups.create!(group_number: allocate_next_group_number!(tournament))
            end
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

      def start_position_limit_error(tournament, course_key, hole_number)
        "#{tournament.starting_hole_description(course_key, hole_number)} already has #{tournament.start_positions_per_hole} pairing#{tournament.start_positions_per_hole == 1 ? '' : 's'}"
      end

      def merge_groups!(source_group:, target_group:)
        next_position = target_group.golfers.maximum(:position).to_i

        source_group.golfers.order(:position).each do |golfer|
          next_position += 1
          raise ActiveRecord::RecordInvalid, golfer unless golfer.assign_to_group(group: target_group, position: next_position)
        end

        source_group.scores.destroy_all
        source_group.destroy!
      end

      def placement_mode_new_pairing?
        params[:placement_mode].to_s == "new_pairing"
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

      def allocate_next_group_number!(tournament)
        tournament.lock!
        (tournament.groups.maximum(:group_number) || 0) + 1
      end

      def tracked_label_changes(tournament, positions)
        tracked_groups_for_positions(tournament, positions).each_with_object({}) do |tracked_group, labels|
          labels[tracked_group.id] = tracked_group.starting_position_label
        end
      end

      def tracked_groups_for_positions(tournament, positions)
        valid_positions = positions.compact.uniq
        return [] if valid_positions.empty?

        conditions = valid_positions.map do |course_key, hole_number|
          Group.where(
            tournament_id: tournament.id,
            starting_course_key: course_key,
            hole_number: hole_number
          )
        end

        scope = conditions.reduce { |combined, relation| combined.or(relation) }
        groups = scope.includes(:golfers).to_a.select { |tracked_group| tracked_group.golfers.any? }
        preload_group_position_letters(groups)
      end

      def log_starting_position_adjustments(tournament:, positions:, previous_labels:, excluded_group_ids: [])
        tracked_groups_for_positions(tournament, positions).each do |tracked_group|
          next if excluded_group_ids.include?(tracked_group.id)

          previous_label = previous_labels[tracked_group.id]
          next if previous_label.blank?
          next if previous_label == tracked_group.starting_position_label

          tracked_group.golfers.each do |golfer|
            ActivityLog.log(
              admin: current_admin,
              action: 'group_updated',
              target: golfer,
              details: "Starting position adjusted to #{tracked_group.starting_position_label} (was #{previous_label})",
              metadata: group_metadata(tracked_group).merge(
                previous_label: previous_label,
                auto_adjusted: true,
                golfer_name: golfer.name
              ),
              tournament: tournament
            )
          end
        end
      end

      def starting_position_key(group)
        return nil unless group.starting_course_key.present? && group.hole_number.present?

        [group.starting_course_key, group.hole_number]
      end

      def starting_position_key_for_attributes(attributes)
        return nil unless attributes[:starting_course_key].present? && attributes[:hole_number].present?

        [attributes[:starting_course_key], attributes[:hole_number]]
      end

      def serialize_group_payload(group)
        fresh_group = Group.includes(:golfers, :tournament).find(group.id)
        preload_group_position_letters([fresh_group])
        ActiveModelSerializers::SerializableResource.new(fresh_group, include: "golfers").as_json
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
