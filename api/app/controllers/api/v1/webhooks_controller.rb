module Api
  module V1
    class WebhooksController < ApplicationController
      # Skip CSRF protection and authentication for webhooks
      skip_before_action :verify_authenticity_token, raise: false
      skip_before_action :authenticate_user!, raise: false

      # POST /api/v1/webhooks/stripe
      def stripe
        payload = request.body.read
        sig_header = request.env["HTTP_STRIPE_SIGNATURE"]

        setting = Setting.instance
        webhook_secret = setting.stripe_webhook_secret || ENV["STRIPE_WEBHOOK_SECRET"]

        unless setting.stripe_secret_key.present?
          Rails.logger.error("Stripe webhook received but Stripe is not configured")
          head :service_unavailable
          return
        end

        Stripe.api_key = setting.stripe_secret_key

        begin
          # Verify the webhook signature if we have a webhook secret
          if webhook_secret.present?
            event = Stripe::Webhook.construct_event(payload, sig_header, webhook_secret)
          else
            if Rails.env.production?
              Rails.logger.error("Stripe webhook secret is missing in production")
              head :bad_request
              return
            end

            # Development/testing fallback without signature verification
            data = JSON.parse(payload, symbolize_names: true)
            event = Stripe::Event.construct_from(data)
            Rails.logger.warn("Stripe webhook received without signature verification")
          end
        rescue JSON::ParserError => e
          Rails.logger.error("Invalid webhook payload: #{e.message}")
          head :bad_request
          return
        rescue Stripe::SignatureVerificationError => e
          Rails.logger.error("Stripe signature verification failed: #{e.message}")
          head :bad_request
          return
        end

        # Handle the event
        case event.type
        when "checkout.session.completed"
          handle_checkout_session_completed(event.data.object)
        when "checkout.session.expired"
          handle_checkout_session_expired(event.data.object)
        when "payment_intent.succeeded"
          handle_payment_intent_succeeded(event.data.object)
        when "payment_intent.payment_failed"
          handle_payment_intent_failed(event.data.object)
        else
          Rails.logger.info("Unhandled Stripe event type: #{event.type}")
        end

        head :ok
      end

      private

      def handle_checkout_session_completed(session)
        Rails.logger.info("Checkout session completed: #{session.id}")

        # Find the golfer by session ID
        golfer = Golfer.find_by(stripe_checkout_session_id: session.id)

        unless golfer
          # Try to find by metadata
          golfer_id = session.metadata&.golfer_id
          golfer = Golfer.find_by(id: golfer_id) if golfer_id.present?
        end

        unless golfer
          Rails.logger.error("Golfer not found for session: #{session.id}")
          return
        end

        # Skip if already paid (idempotency)
        if golfer.payment_status == "paid"
          Rails.logger.info("Golfer #{golfer.id} already marked as paid")
          return
        end

        # Update payment status
        golfer.update!(
          payment_status: "paid",
          stripe_payment_intent_id: session.payment_intent,
          payment_method: "stripe",
          payment_notes: "Paid via Stripe on #{Time.current.strftime('%Y-%m-%d %H:%M:%S')} (webhook confirmed)",
          paid_at: Time.current
        )

        Rails.logger.info("Golfer #{golfer.id} marked as paid via webhook")

        # Send confirmation emails with staggered delays to avoid rate limiting
        GolferMailer.payment_confirmation_email(golfer).deliver_later
        AdminMailer.notify_payment_received(golfer).deliver_later(wait: 2.seconds)

        # Broadcast update (non-critical - wrapped in rescue)
        begin
          ActionCable.server.broadcast("golfers_channel_#{golfer.tournament_id}", {
            action: "payment_confirmed",
            golfer: GolferSerializer.new(golfer).as_json
          })
        rescue StandardError => e
          Rails.logger.error("Failed to broadcast payment confirmation (webhook): #{e.message}")
        end
      end

      def handle_checkout_session_expired(session)
        Rails.logger.info("Checkout session expired: #{session.id}")

        golfer = Golfer.find_by(stripe_checkout_session_id: session.id)
        return unless golfer

        # Clear the session ID so they can try again
        golfer.update(stripe_checkout_session_id: nil)

        Rails.logger.info("Cleared expired checkout session for golfer #{golfer.id}")
      end

      def handle_payment_intent_succeeded(payment_intent)
        Rails.logger.info("Payment intent succeeded: #{payment_intent.id}")
        # The checkout.session.completed event handles our use case,
        # but we log this for completeness
      end

      def handle_payment_intent_failed(payment_intent)
        Rails.logger.error("Payment intent failed: #{payment_intent.id}")
        
        # Find the golfer by payment intent ID if we have it
        golfer = Golfer.find_by(stripe_payment_intent_id: payment_intent.id)
        return unless golfer

        # Update notes to indicate failed payment
        golfer.update(
          payment_notes: "Payment failed on #{Time.current.strftime('%Y-%m-%d %H:%M:%S')}: #{payment_intent.last_payment_error&.message}"
        )
      end
    end
  end
end

