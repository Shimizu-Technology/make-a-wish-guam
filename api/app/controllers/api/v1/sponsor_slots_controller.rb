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
        slot = @sponsor.sponsor_slots.find(params[:id])

        slot.update!(
          player_name: params[:player_name],
          player_email: params[:player_email],
          player_phone: params[:player_phone],
          confirmed_at: Time.current
        )

        render json: { slot: slot.as_json(only: [:id, :slot_number, :player_name, :player_email, :player_phone, :confirmed_at]) }
      end

      private

      def authenticate_sponsor!
        token = request.headers["X-Sponsor-Token"] || params[:token]
        @sponsor = Sponsor.find_by_access_token(token)

        unless @sponsor
          render json: { error: "Invalid or expired access token" }, status: :unauthorized
        end
      end
    end
  end
end
