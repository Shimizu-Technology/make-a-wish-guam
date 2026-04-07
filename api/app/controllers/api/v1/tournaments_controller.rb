module Api
  module V1
    class TournamentsController < BaseController
      skip_before_action :authenticate_user!, only: [:current]
      before_action :set_tournament, only: [:show, :update, :destroy, :archive, :copy, :open, :close]
      before_action :authorize_tournament_access!, only: [:show, :update, :destroy, :archive, :copy, :open, :close]

      # GET /api/v1/tournaments
      # List all tournaments (for admin dropdown)
      def index
        tournaments = current_user.accessible_tournaments.recent
        
        # Filter by status if provided
        tournaments = tournaments.where(status: params[:status]) if params[:status].present?
        
        render json: tournaments, each_serializer: TournamentSerializer
      end

      # GET /api/v1/tournaments/current
      # Get the current open tournament (for public registration)
      def current
        tournament = Tournament.current
        
        if tournament
          render json: tournament, serializer: TournamentSerializer
        else
          render json: { error: "No active tournament found" }, status: :not_found
        end
      end

      # GET /api/v1/tournaments/:id
      def show
        render json: @tournament, serializer: TournamentSerializer
      end

      # POST /api/v1/tournaments
      def create
        organization = Organization.find_by(id: params.dig(:tournament, :organization_id))
        unless organization
          render json: { errors: ["Organization is required"] }, status: :unprocessable_entity
          return
        end

        require_org_admin!(organization)
        return if performed?

        tournament = organization.tournaments.new(tournament_params.except(:organization_id))
        
        if tournament.save
          ActivityLog.log(
            admin: current_admin,
            action: 'tournament_created',
            target: tournament,
            details: "Created tournament: #{tournament.display_name}"
          )
          render json: tournament, serializer: TournamentSerializer, status: :created
        else
          render json: { errors: tournament.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/tournaments/:id
      def update
        attrs = tournament_params.except(:organization_id, :sponsor_tiers,
                                         :raffle_include_with_registration, :raffle_bundles)

        merged_config = (@tournament.config || {}).deep_dup

        if params.dig(:tournament, :sponsor_tiers).present?
          tiers = tournament_params[:sponsor_tiers]&.map(&:to_h)
          merged_config['sponsor_tiers'] = tiers
        end

        if params[:tournament].key?(:raffle_include_with_registration)
          merged_config['raffle_include_with_registration'] =
            ActiveModel::Type::Boolean.new.cast(params[:tournament][:raffle_include_with_registration])
        end

        if params.dig(:tournament, :raffle_bundles).present?
          merged_config['raffle_bundles'] = tournament_params[:raffle_bundles]&.map(&:to_h)
        end

        attrs[:config] = merged_config if merged_config != @tournament.config

        if @tournament.update(attrs)
          ActivityLog.log(
            admin: current_admin,
            action: 'tournament_updated',
            target: @tournament,
            details: "Updated tournament: #{@tournament.display_name}"
          )
          render json: @tournament, serializer: TournamentSerializer
        else
          render json: { errors: @tournament.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/tournaments/:id
      def destroy
        if @tournament.golfers.any? || @tournament.groups.any?
          render json: { 
            error: "Cannot delete tournament with existing golfers or groups. Archive it instead." 
          }, status: :unprocessable_entity
          return
        end
        
        @tournament.destroy!
        head :no_content
      end

      # POST /api/v1/tournaments/:id/archive
      def archive
        @tournament.archive!
        
        ActivityLog.log(
          admin: current_admin,
          action: 'tournament_archived',
          target: @tournament,
          details: "Archived tournament: #{@tournament.display_name}"
        )
        
        render json: @tournament, serializer: TournamentSerializer
      end

      # POST /api/v1/tournaments/:id/copy
      # Create a new tournament based on this one (for next year)
      def copy
        new_tournament = @tournament.copy_for_next_year
        
        if new_tournament.save
          ActivityLog.log(
            admin: current_admin,
            action: 'tournament_created',
            target: new_tournament,
            details: "Created tournament #{new_tournament.display_name} (copied from #{@tournament.display_name})"
          )
          render json: new_tournament, serializer: TournamentSerializer, status: :created
        else
          render json: { errors: new_tournament.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/tournaments/:id/open
      # Open tournament for registration
      def open
        # Close any other open tournaments in the same organization first
        Tournament.where(status: 'open', organization_id: @tournament.organization_id)
                  .where.not(id: @tournament.id)
                  .update_all(status: 'closed')
        
        @tournament.update!(status: 'open', registration_open: true)
        
        ActivityLog.log(
          admin: current_admin,
          action: 'tournament_updated',
          target: @tournament,
          details: "Opened tournament for registration: #{@tournament.display_name}"
        )
        
        render json: @tournament, serializer: TournamentSerializer
      end

      # POST /api/v1/tournaments/:id/close
      # Close tournament registration
      def close
        @tournament.update!(status: 'closed', registration_open: false)
        
        ActivityLog.log(
          admin: current_admin,
          action: 'tournament_updated',
          target: @tournament,
          details: "Closed tournament: #{@tournament.display_name}"
        )
        
        render json: @tournament, serializer: TournamentSerializer
      end

      private

      def set_tournament
        @tournament = Tournament.find(params[:id])
      end

      def authorize_tournament_access!
        require_tournament_admin!(@tournament)
      end

      def tournament_params
        params.require(:tournament).permit(
          :organization_id,
          :name, :year, :edition, :status,
          :event_date, :registration_time, :start_time,
          :location_name, :location_address,
          :tournament_format, :team_size,
          :max_capacity, :reserved_slots, :entry_fee, :employee_entry_fee,
          :format_name, :fee_includes, :checks_payable_to,
          :contact_name, :contact_phone, :contact_email,
          :registration_open, :registration_deadline,
          :waitlist_enabled, :waitlist_max,
          :swipe_simple_url, :walkin_swipe_simple_url,
          :entry_fee_display,
          :raffle_enabled, :raffle_ticket_price_cents, :raffle_draw_time,
          :raffle_description, :raffle_auto_draw,
          :raffle_max_tickets_per_person, :raffle_tickets_per_purchase,
          :walkin_fee, :walkin_registration_open,
          :sponsor_edit_deadline,
          :event_schedule, :payment_instructions,
          :check_in_time,
          :raffle_include_with_registration,
          config: {},
          sponsor_tiers: [:key, :label, :sort_order],
          raffle_bundles: [:quantity, :price_cents, :label]
        )
      end
    end
  end
end

