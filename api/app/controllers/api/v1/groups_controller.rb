module Api
  module V1
    class GroupsController < BaseController
      before_action :authorize_collection_tournament_access!, only: [:index, :create, :batch_create, :auto_assign]
      before_action :authorize_group_access!, only: [:show, :update, :destroy, :set_hole, :add_golfer, :remove_golfer]
      before_action :authorize_update_positions_access!, only: [:update_positions]

      # GET /api/v1/groups
      def index
        tournament = find_tournament
        return render_tournament_required unless tournament

        groups = tournament.groups.with_golfers

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
        group = tournament.groups.new(group_number: next_number, hole_number: params[:hole_number])

        if group.save
          ActivityLog.log(
            admin: current_admin,
            action: 'group_created',
            target: group,
            details: "Created Hole #{group.hole_position_label}",
            metadata: { hole_number: group.hole_number, group_number: group.group_number }
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
        old_hole = group.hole_number

        if group.update(group_params)
          if old_hole != group.hole_number
            ActivityLog.log(
              admin: current_admin,
              action: 'group_updated',
              target: group,
              details: "Moved group to Hole #{group.hole_position_label} (was Hole #{old_hole || 'unassigned'})",
              metadata: { previous_hole: old_hole, new_hole: group.hole_number, group_number: group.group_number }
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

        # Remove all golfers from the group first
        group.golfers.update_all(group_id: nil, position: nil)

        hole_label = group.hole_position_label
        group.destroy
        
        ActivityLog.log(
          admin: current_admin,
          action: 'group_deleted',
          target: nil,
          tournament: tournament,
          details: "Deleted Hole #{hole_label}",
          metadata: { group_number: group_number, hole_label: hole_label, removed_golfers: golfer_names }
        )
        
        broadcast_groups_update(tournament)
        head :no_content
      end

      # POST /api/v1/groups/:id/set_hole
      def set_hole
        group = Group.find(params[:id])
        old_hole = group.hole_number

        unless (1..18).include?(params[:hole_number].to_i)
          render json: { error: "Hole number must be between 1 and 18" }, status: :unprocessable_entity
          return
        end

        if group.update(hole_number: params[:hole_number])
          ActivityLog.log(
            admin: current_admin,
            action: 'group_updated',
            target: group,
            details: "Assigned to Hole #{group.hole_position_label}",
            metadata: { previous_hole: old_hole, new_hole: group.hole_number, group_number: group.group_number }
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

        if group.full?
          render json: { error: "Group is full (max #{Group::MAX_GOLFERS} golfers)" }, status: :unprocessable_entity
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
            details: "Added #{golfer.name} to Hole #{group.hole_position_label}",
            metadata: { group_id: group.id, group_number: group.group_number, hole_label: group.hole_position_label }
          )
          broadcast_groups_update(group.tournament)
          render json: group, include: "golfers"
        else
          render json: { error: "Failed to add golfer to group" }, status: :unprocessable_entity
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

        hole_label = group.hole_position_label
        group.remove_golfer(golfer)
        
        ActivityLog.log(
          admin: current_admin,
          action: 'golfer_removed_from_group',
          target: golfer,
          details: "Removed #{golfer.name} from Hole #{hole_label}",
          metadata: { group_id: group.id, group_number: group.group_number, hole_label: hole_label }
        )
        
        broadcast_groups_update(group.tournament)
        render json: group, include: "golfers"
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

        unassigned.each do |golfer|
          # Find or create a group with space
          group = tournament.groups.includes(:golfers)
                       .select { |g| g.golfers.count < Group::MAX_GOLFERS }
                       .first

          unless group
            next_number = (tournament.groups.maximum(:group_number) || 0) + 1
            group = tournament.groups.create!(group_number: next_number)
          end

          group.add_golfer(golfer)
          assigned_count += 1
        end

        broadcast_groups_update(tournament)
        render json: {
          message: "Auto-assigned #{assigned_count} golfers",
          assigned_count: assigned_count
        }
      end

      private

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
        params.require(:group).permit(:group_number, :hole_number)
      end

      def broadcast_groups_update(tournament)
        return unless tournament
        
        groups = tournament.groups.with_golfers
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
