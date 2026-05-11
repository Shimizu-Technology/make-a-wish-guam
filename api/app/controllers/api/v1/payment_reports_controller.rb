# frozen_string_literal: true

module Api
  module V1
    class PaymentReportsController < BaseController
      before_action :set_tournament
      before_action :authorize_volunteer_or_admin!

      def show
        golfers = @tournament.golfers.includes(:sponsor, :payment_verified_by).order(:created_at)
        raffle_tickets = @tournament.raffle_tickets.includes(:golfer, :sold_by_user, :raffle_prize).order(:sequence_number, :created_at)

        registration_payments = golfers.reject { |golfer| golfer.payment_type == "sponsor" }.map { |golfer| registration_payment_row(golfer) }
        sponsored_registrations = golfers.select { |golfer| golfer.payment_type == "sponsor" }.map { |golfer| sponsored_registration_row(golfer) }
        raffle_sales = raffle_tickets.map { |ticket| raffle_sale_row(ticket) }

        render json: {
          tournament: {
            id: @tournament.id,
            name: @tournament.name,
            event_date: @tournament.event_date,
            entry_fee_cents: @tournament.entry_fee
          },
          summary: report_summary(registration_payments, sponsored_registrations, raffle_sales),
          registration_payments: registration_payments,
          sponsored_registrations: sponsored_registrations,
          raffle_sales: raffle_sales,
          combined_ledger: combined_ledger(registration_payments, raffle_sales)
        }
      end

      private

      def set_tournament
        @tournament = Tournament.find(params[:tournament_id])
      end

      def authorize_volunteer_or_admin!
        require_volunteer_or_admin!(@tournament.organization)
      end

      def registration_payment_row(golfer)
        amount_cents = registration_amount_cents(golfer)
        {
          id: golfer.id,
          type: "registration",
          name: golfer.name,
          partner_name: golfer.partner_name,
          email: golfer.email,
          phone: golfer.phone,
          company: golfer.company,
          registration_status: golfer.registration_status,
          payment_status: golfer.payment_status,
          payment_type: golfer.payment_type,
          payment_method: golfer.payment_method,
          payment_method_label: payment_method_label(golfer.payment_method || golfer.payment_type),
          amount_cents: amount_cents,
          paid_at: golfer.paid_at&.iso8601,
          verified_at: golfer.payment_verified_at&.iso8601,
          verified_by_name: golfer.payment_verified_by_name,
          receipt_number: golfer.receipt_number,
          payment_notes: golfer.payment_notes,
          source: golfer.registration_source,
          created_at: golfer.created_at&.iso8601,
          refund_amount_cents: golfer.refund_amount_cents,
          refunded_at: golfer.refunded_at&.iso8601,
          refund_reason: golfer.refund_reason
        }
      end

      def sponsored_registration_row(golfer)
        {
          id: golfer.id,
          type: "sponsored_registration",
          name: golfer.name,
          partner_name: golfer.partner_name,
          sponsor_name: golfer.sponsor_name.presence || golfer.sponsor&.name,
          registration_status: golfer.registration_status,
          payment_status: golfer.payment_status,
          operationally_cleared: golfer.registration_status == "confirmed",
          source: golfer.registration_source,
          created_at: golfer.created_at&.iso8601,
          notes: golfer.notes
        }
      end

      def raffle_sale_row(ticket)
        amount_cents = ticket.price_cents.to_i
        {
          id: ticket.id,
          type: "raffle",
          ticket_number: ticket.display_number,
          purchaser_name: ticket.purchaser_display,
          purchaser_email: ticket.purchaser_email,
          purchaser_phone: ticket.purchaser_phone,
          golfer_id: ticket.golfer_id,
          golfer_name: ticket.golfer&.name,
          payment_status: ticket.payment_status,
          payment_method: ticket.payment_method,
          payment_method_label: payment_method_label(ticket.payment_method),
          amount_cents: amount_cents,
          complimentary: amount_cents.zero?,
          included_with_registration: amount_cents.zero? && ticket.golfer_id.present?,
          purchased_at: ticket.purchased_at&.iso8601,
          created_at: ticket.created_at&.iso8601,
          sold_by_name: ticket.sold_by_user&.name || ticket.sold_by_user&.email,
          receipt_number: ticket.receipt_number,
          payment_notes: ticket.payment_notes,
          is_winner: ticket.is_winner,
          prize_won: ticket.raffle_prize&.name,
          voided_at: ticket.voided_at&.iso8601,
          void_reason: ticket.void_reason
        }
      end

      def report_summary(registration_payments, sponsored_registrations, raffle_sales)
        paid_registration_rows = registration_payments.select { |row| row[:payment_status] == "paid" }
        paid_raffle_rows = raffle_sales.select { |row| row[:payment_status] == "paid" && row[:amount_cents].positive? }
        pending_raffle_rows = raffle_sales.select { |row| row[:payment_status] == "pending" && row[:amount_cents].positive? }

        {
          registration_revenue_cents: paid_registration_rows.sum { |row| row[:amount_cents].to_i },
          raffle_revenue_cents: paid_raffle_rows.sum { |row| row[:amount_cents].to_i },
          total_revenue_cents: paid_registration_rows.sum { |row| row[:amount_cents].to_i } + paid_raffle_rows.sum { |row| row[:amount_cents].to_i },
          registration_paid_count: paid_registration_rows.count,
          registration_pending_count: registration_payments.count { |row| %w[pending unpaid].include?(row[:payment_status]) && row[:registration_status] != "cancelled" },
          sponsored_registration_count: sponsored_registrations.count { |row| row[:registration_status] == "confirmed" },
          raffle_paid_ticket_count: raffle_sales.count { |row| row[:payment_status] == "paid" },
          raffle_purchased_ticket_count: paid_raffle_rows.count,
          raffle_complimentary_ticket_count: raffle_sales.count { |row| row[:complimentary] && row[:payment_status] != "voided" },
          raffle_pending_ticket_count: pending_raffle_rows.count,
          raffle_voided_ticket_count: raffle_sales.count { |row| row[:payment_status] == "voided" },
          raffle_winner_count: raffle_sales.count { |row| row[:is_winner] && row[:payment_status] != "voided" },
          raffle_pending_revenue_cents: pending_raffle_rows.sum { |row| row[:amount_cents].to_i },
          refunded_registration_amount_cents: registration_payments.sum { |row| row[:refund_amount_cents].to_i }
        }
      end

      def combined_ledger(registration_payments, raffle_sales)
        registration_rows = registration_payments
          .select { |row| row[:payment_status] == "paid" || row[:payment_status] == "refunded" }
          .map do |row|
            {
              type: "registration",
              name: row[:name],
              detail: row[:partner_name].present? ? "Team with #{row[:partner_name]}" : "Registration",
              payment_status: row[:payment_status],
              payment_method: row[:payment_method],
              amount_cents: row[:amount_cents],
              paid_at: row[:paid_at] || row[:verified_at],
              reference: row[:receipt_number],
              notes: row[:payment_notes]
            }
          end

        raffle_rows = raffle_sales
          .select { |row| row[:payment_status] == "paid" && row[:amount_cents].positive? }
          .map do |row|
            {
              type: "raffle",
              name: row[:purchaser_name],
              detail: row[:ticket_number],
              payment_status: row[:payment_status],
              payment_method: row[:payment_method],
              amount_cents: row[:amount_cents],
              paid_at: row[:purchased_at],
              reference: row[:receipt_number],
              notes: row[:payment_notes]
            }
          end

        (registration_rows + raffle_rows).sort_by { |row| row[:paid_at].presence || "" }
      end

      def registration_amount_cents(golfer)
        return golfer.payment_amount_cents.to_i if golfer.payment_amount_cents.present?
        return golfer.tournament.entry_fee.to_i if golfer.payment_status == "paid"

        0
      end

      def payment_method_label(method)
        case method
        when "stripe" then "Stripe"
        when "swipe_simple", "swipesimple", "swipe_simple_confirmed" then "SwipeSimple"
        when "pay_on_day" then "Pay on Day"
        when "walk_in" then "Walk-in"
        when "cash" then "Cash"
        when "check" then "Check"
        when "card", "credit" then "Card"
        when "comp" then "Comp"
        when "sponsor" then "Sponsor"
        when nil, "" then nil
        else method.to_s.humanize
        end
      end
    end
  end
end
