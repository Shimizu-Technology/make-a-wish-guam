module Api
  module V1
    class SponsorSlotsController < BaseController
      skip_before_action :authenticate_user!
      before_action :authenticate_sponsor!

      # GET /api/v1/sponsor_slots
      def index
        slots = @sponsor.sponsor_slots.order(:slot_number)
        render json: { slots: slots.as_json(only: [:id, :slot_number, :player_name, :player_email, :player_phone, :confirmed_at]) }
      end

      # PATCH /api/v1/sponsor_slots/:id
      def update
        deadline = @sponsor.tournament.sponsor_edit_deadline
        if deadline.present? && Time.current > deadline
          render json: { error: "The deadline for editing player slots has passed." }, status: :forbidden
          return
        end

        slot = @sponsor.sponsor_slots.find(params[:id])

        slot.update!(
          player_name: params[:player_name],
          player_email: params[:player_email],
          player_phone: params[:player_phone],
          confirmed_at: Time.current
        )

        begin
          SponsorSlotSyncer.new(@sponsor).sync_slot(slot)
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: "Slot saved but player roster sync failed: #{e.message}" }, status: :unprocessable_entity
          return
        end

        render json: { slot: slot.as_json(only: [:id, :slot_number, :player_name, :player_email, :player_phone, :confirmed_at]) }
      end

      private

      def authenticate_sponsor!
        session_token = request.headers["X-Sponsor-Session"] || params[:session_token]
        @sponsor = Sponsor.find_by_portal_session_token(session_token)

        unless @sponsor
          render json: { error: "Invalid or expired sponsor session" }, status: :unauthorized
        end
      end
    end
  end
end
