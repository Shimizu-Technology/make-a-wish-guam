module Api
  module V1
    class SponsorAccessController < BaseController
      skip_before_action :authenticate_user!

      # POST /api/v1/sponsor_access/request_link
      def request_link
        email = params[:email]&.strip&.downcase
        unless email.present?
          render json: { error: "Email is required" }, status: :unprocessable_entity
          return
        end

        sponsor = Sponsor.find_by("LOWER(login_email) = ?", email)
        unless sponsor
          # Don't reveal whether sponsor exists
          render json: { message: "If that email is associated with a sponsor account, you will receive an access link." }
          return
        end

        token = sponsor.generate_access_token!

        begin
          SponsorMailer.access_link(sponsor, token).deliver_later
        rescue StandardError => e
          Rails.logger.error("Failed to send sponsor access link: #{e.message}")
        end

        render json: { message: "If that email is associated with a sponsor account, you will receive an access link." }
      end

      # GET /api/v1/sponsor_access/verify?token=xxx
      def verify
        token = params[:token]
        sponsor = Sponsor.find_by_access_token(token)

        unless sponsor
          render json: { error: "Invalid or expired access link" }, status: :unauthorized
          return
        end

        render json: {
          sponsor: {
            id: sponsor.id,
            name: sponsor.name,
            tier: sponsor.tier,
            tier_display: sponsor.tier_display,
            slot_count: sponsor.slot_count,
            tournament_id: sponsor.tournament_id
          },
          token: token
        }
      end
    end
  end
end
