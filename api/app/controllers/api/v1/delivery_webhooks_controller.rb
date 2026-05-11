# frozen_string_literal: true

module Api
  module V1
    class DeliveryWebhooksController < BaseController
      skip_before_action :authenticate_user!
      before_action :verify_delivery_webhook_token!

      # POST /api/v1/webhooks/resend
      def resend
        payload = webhook_payload
        event_type = payload["type"].to_s
        data = (payload["data"] || {}).with_indifferent_access
        provider_message_id = data[:email_id].presence || data[:id].presence || data[:message_id].presence

        delivery = MessageDelivery.where(provider: "resend", provider_message_id: provider_message_id).recent.first
        return render json: { message: "No matching delivery", provider_message_id: provider_message_id }, status: :accepted if delivery.blank?

        delivery.apply_provider_event!(
          status: resend_status(event_type),
          provider_status_text: event_type,
          error_text: data[:error].presence || data[:reason].presence,
          payload: payload
        )

        render json: { message: "Delivery updated", delivery_id: delivery.id, status: delivery.status }
      end

      # POST /api/v1/webhooks/clicksend
      def clicksend
        payload = webhook_payload
        provider_message_id = payload["message_id"].presence || payload["original_message_id"].presence
        delivery = MessageDelivery.where(provider: "clicksend", provider_message_id: provider_message_id).recent.first
        return render json: { message: "No matching delivery", provider_message_id: provider_message_id }, status: :accepted if delivery.blank?

        status_text = payload["status_text"].presence || payload["status"].presence
        delivery.apply_provider_event!(
          status: status_text.presence || payload["status_code"],
          provider_status_code: payload["status_code"],
          provider_status_text: status_text,
          error_code: payload["error_code"],
          error_text: payload["error_text"],
          payload: payload
        )

        render json: { message: "Delivery updated", delivery_id: delivery.id, status: delivery.status }
      end

      private

      def webhook_payload
        request.request_parameters.presence || JSON.parse(request.raw_post.presence || "{}")
      rescue JSON::ParserError
        {}
      end

      def verify_delivery_webhook_token!
        provider_token =
          if action_name == "clicksend"
            ENV["CLICKSEND_WEBHOOK_TOKEN"].presence
          elsif action_name == "resend"
            ENV["RESEND_WEBHOOK_TOKEN"].presence
          end
        expected = provider_token || ENV["DELIVERY_WEBHOOK_TOKEN"].presence
        return if expected.blank?

        provided = params[:token].presence || request.headers["X-Webhook-Token"].presence
        valid = provided.present? &&
          provided.to_s.bytesize == expected.to_s.bytesize &&
          ActiveSupport::SecurityUtils.secure_compare(provided.to_s, expected.to_s)
        render json: { error: "Invalid webhook token" }, status: :unauthorized unless valid
      end

      def resend_status(event_type)
        case event_type
        when "email.sent"
          "accepted"
        when "email.delivered"
          "delivered"
        when "email.bounced"
          "bounced"
        when "email.delivery_delayed"
          "delayed"
        when "email.complained"
          "complained"
        else
          event_type.include?("failed") ? "failed" : "accepted"
        end
      end
    end
  end
end
