module Api
  module V1
    class PaymentLinksController < ApplicationController
      skip_before_action :authenticate_user!, raise: false
      skip_before_action :verify_authenticity_token, raise: false

      # GET /api/v1/payment_links/:token
      def show
        golfer = Golfer.find_by(payment_token: params[:token])
        
        unless golfer
          render json: { error: "Invalid or expired payment link" }, status: :not_found
          return
        end

        if golfer.payment_status == "paid"
          render json: { 
            error: "This payment has already been completed",
            already_paid: true,
            golfer: { name: golfer.name, email: golfer.email }
          }, status: :unprocessable_entity
          return
        end

        if golfer.registration_status == "cancelled"
          render json: { error: "This registration has been cancelled" }, status: :unprocessable_entity
          return
        end

        tournament = golfer.tournament
        entry_fee = tournament&.entry_fee || 12500

        render json: {
          golfer: {
            id: golfer.id,
            name: golfer.name,
            email: golfer.email,
            phone: golfer.phone,
            company: golfer.company,
            registration_status: golfer.registration_status
          },
          tournament: {
            id: tournament.id,
            name: tournament.name,
            event_date: tournament.event_date,
            location_name: tournament.location_name
          },
          entry_fee_cents: entry_fee,
          entry_fee_dollars: entry_fee / 100.0
        }
      end

      # POST /api/v1/payment_links/:token/checkout
      def create_checkout
        golfer = Golfer.find_by(payment_token: params[:token])
        
        unless golfer
          render json: { error: "Invalid or expired payment link" }, status: :not_found
          return
        end

        if golfer.payment_status == "paid"
          render json: { error: "This payment has already been completed" }, status: :unprocessable_entity
          return
        end

        if golfer.registration_status == "cancelled"
          render json: { error: "This registration has been cancelled" }, status: :unprocessable_entity
          return
        end

        setting = Setting.instance
        tournament = golfer.tournament
        
        if setting.test_mode?
          return handle_test_mode(golfer, tournament)
        end

        unless setting.stripe_secret_key.present?
          render json: { error: "Payment processing is not configured" }, status: :service_unavailable
          return
        end

        Stripe.api_key = setting.stripe_secret_key
        frontend_url = ENV.fetch("FRONTEND_URL", "http://localhost:5173")
        entry_fee = tournament&.entry_fee || 12500

        begin
          session = Stripe::Checkout::Session.create({
            ui_mode: "embedded",
            payment_method_types: ["card"],
            line_items: [{
              price_data: {
                currency: "usd",
                product_data: {
                  name: "#{tournament.name} Entry Fee",
                  description: "Golf Tournament Registration - #{golfer.name}",
                },
                unit_amount: entry_fee,
              },
              quantity: 1,
            }],
            mode: "payment",
            return_url: "#{frontend_url}/pay/#{params[:token]}/success?session_id={CHECKOUT_SESSION_ID}",
            customer_email: golfer.email,
            metadata: {
              golfer_id: golfer.id.to_s,
              tournament_id: tournament.id.to_s,
              payment_token: params[:token]
            }
          })

          golfer.update!(stripe_checkout_session_id: session.id)

          render json: {
            client_secret: session.client_secret,
            session_id: session.id
          }
        rescue Stripe::StripeError => e
          Rails.logger.error("Stripe error creating checkout: #{e.message}")
          render json: { error: "Failed to create checkout session: #{e.message}" }, status: :unprocessable_entity
        end
      end

      private

      def handle_test_mode(golfer, tournament)
        entry_fee = tournament&.entry_fee || 12500
        test_session_id = "test_paylink_#{SecureRandom.hex(16)}"
        test_payment_intent_id = "test_pi_paylink_#{SecureRandom.hex(8)}"
        emails_sent = false

        ActiveRecord::Base.transaction do
          golfer.lock!
          
          if golfer.payment_status == "paid"
            render json: {
              test_mode: true, success: true,
              message: "Payment already completed", already_paid: true
            }
            return
          end

          golfer.update!(
            payment_status: "paid",
            payment_type: "stripe",
            stripe_checkout_session_id: test_session_id,
            stripe_payment_intent_id: test_payment_intent_id,
            payment_method: "stripe",
            payment_amount_cents: entry_fee,
            payment_notes: "Paid via payment link (test mode) on #{Time.current.in_time_zone('Pacific/Guam').strftime('%B %d, %Y at %I:%M %p')} (Guam Time)"
          )

          ActivityLog.log(
            admin: nil,
            action: 'payment_completed',
            target: golfer,
            details: "Payment of $#{format('%.2f', entry_fee / 100.0)} completed via payment link",
            tournament: tournament
          )

          emails_sent = true
        end

        Rails.cache.write(test_session_id, { golfer_id: golfer.id, amount: entry_fee }, expires_in: 1.hour)

        if emails_sent
          GolferMailer.confirmation_with_payment_email(golfer).deliver_later rescue nil
          AdminMailer.notify_new_registration_with_payment(golfer).deliver_later(wait: 2.seconds) rescue nil
        end

        render json: {
          test_mode: true, success: true,
          message: "Payment simulated successfully (test mode)",
          session_id: test_session_id
        }
      end
    end
  end
end
