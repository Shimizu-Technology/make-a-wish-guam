# frozen_string_literal: true

module Api
  module V1
    class PaymentReportsController < BaseController
      before_action :set_tournament
      before_action :authorize_volunteer_or_admin!

      def show
        golfers = @tournament.golfers.includes(:sponsor, :payment_verified_by).order(:created_at)
        raffle_tickets = @tournament.raffle_tickets
          .includes(:golfer, :sold_by_user, :raffle_prize, :raffle_sale_batch)
          .order(:sequence_number, :created_at)

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
          raffle_sale_groups: raffle_sale_groups(raffle_sales),
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
          raffle_sale_batch_id: ticket.raffle_sale_batch_id,
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

      def raffle_sale_groups(raffle_sales)
        rows = raffle_sales
          .select { |row| row[:payment_status] == "paid" && row[:amount_cents].positive? }
          .sort_by { |row| [ row[:purchased_at].presence || row[:created_at].presence || "", ticket_sequence(row[:ticket_number]) ] }

        groups = []
        current_rows = []
        current_key = nil
        current_time = nil

        rows.each do |row|
          row_time = report_time(row[:purchased_at] || row[:created_at])
          key = row[:raffle_sale_batch_id].presence || inferred_sale_key(row)

          if current_rows.any? && (key != current_key || inferred_sale_gap?(current_key, row_time, current_time))
            groups << raffle_sale_group_row(current_rows)
            current_rows = []
          end

          current_rows << row
          current_key = key
          current_time = row_time if row_time.present?
        end

        groups << raffle_sale_group_row(current_rows) if current_rows.any?
        groups
      end

      def inferred_sale_key(row)
        [
          "inferred",
          row[:purchaser_name].to_s.downcase.strip,
          row[:purchaser_email].to_s.downcase.strip,
          row[:purchaser_phone].to_s.gsub(/\D/, ""),
          row[:payment_method].to_s,
          row[:sold_by_name].to_s.downcase.strip,
          row[:receipt_number].to_s
        ].join("|")
      end

      def inferred_sale_gap?(key, row_time, previous_time)
        return false if key.to_s !~ /\Ainferred\|/
        return false if row_time.blank? || previous_time.blank?

        (row_time - previous_time).abs > 2.minutes
      end

      def raffle_sale_group_row(rows)
        sorted_rows = rows.sort_by { |row| ticket_sequence(row[:ticket_number]) }
        first_row = sorted_rows.first
        ticket_numbers = sorted_rows.map { |row| row[:ticket_number] }
        linked_names = sorted_rows.filter_map { |row| row[:golfer_name] }.uniq
        amount_cents = sorted_rows.sum { |row| row[:amount_cents].to_i }

        {
          id: first_row[:raffle_sale_batch_id].presence || "inferred-#{first_row[:id]}",
          type: "raffle_sale_group",
          source: first_row[:raffle_sale_batch_id].present? ? "recorded_batch" : "inferred",
          purchaser_name: first_row[:purchaser_name],
          purchaser_email: first_row[:purchaser_email],
          purchaser_phone: first_row[:purchaser_phone],
          linked_registration_names: linked_names,
          payment_status: first_row[:payment_status],
          payment_method: first_row[:payment_method],
          payment_method_label: first_row[:payment_method_label],
          ticket_count: sorted_rows.count,
          ticket_numbers: ticket_numbers,
          ticket_range: ticket_range(ticket_numbers),
          amount_cents: amount_cents,
          bundle_label: raffle_bundle_label(sorted_rows.count, amount_cents),
          average_ticket_cents: sorted_rows.any? ? (amount_cents.to_f / sorted_rows.count).round(2) : 0,
          purchased_at: first_present(sorted_rows, :purchased_at) || first_present(sorted_rows, :created_at),
          sold_by_name: first_row[:sold_by_name],
          receipt_number: first_row[:receipt_number],
          payment_notes: first_present(sorted_rows, :payment_notes)
        }
      end

      def raffle_bundle_label(ticket_count, amount_cents)
        case [ ticket_count, amount_cents ]
        when [ 1, 500 ] then "1 ticket"
        when [ 4, 2000 ] then "$20 bundle"
        when [ 12, 5000 ] then "$50 bundle"
        when [ 25, 10_000 ] then "$100 bundle"
        else "#{ticket_count} #{'ticket'.pluralize(ticket_count)} for $#{format('%.2f', amount_cents / 100.0)}"
        end
      end

      def ticket_range(ticket_numbers)
        return "" if ticket_numbers.blank?
        return ticket_numbers.first if ticket_numbers.one?

        "#{ticket_numbers.first} to #{ticket_numbers.last}"
      end

      def ticket_sequence(ticket_number)
        ticket_number.to_s[/\d+\z/].to_i
      end

      def report_time(value)
        return if value.blank?

        Time.zone.parse(value.to_s)
      end

      def first_present(rows, key)
        rows.map { |row| row[key] }.find(&:present?)
      end

      def report_summary(registration_payments, sponsored_registrations, raffle_sales)
        paid_registration_rows = registration_payments.select { |row| row[:payment_status] == "paid" }
        paid_raffle_rows = raffle_sales.select { |row| row[:payment_status] == "paid" && row[:amount_cents].positive? }
        pending_raffle_rows = raffle_sales.select { |row| row[:payment_status] == "pending" && row[:amount_cents].positive? }
        registration_revenue_cents = paid_registration_rows.sum { |row| row[:amount_cents].to_i }
        raffle_revenue_cents = paid_raffle_rows.sum { |row| row[:amount_cents].to_i }

        {
          registration_revenue_cents: registration_revenue_cents,
          raffle_revenue_cents: raffle_revenue_cents,
          total_revenue_cents: registration_revenue_cents + raffle_revenue_cents,
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
          .flat_map { |row| registration_ledger_rows(row) }

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

      def registration_ledger_rows(row)
        paid_at = row[:paid_at] || row[:verified_at]
        rows = [
          {
            type: "registration",
            name: row[:name],
            detail: row[:partner_name].present? ? "Team with #{row[:partner_name]}" : "Registration",
            payment_status: row[:payment_status] == "refunded" ? "paid" : row[:payment_status],
            payment_method: row[:payment_method],
            amount_cents: row[:amount_cents],
            paid_at: paid_at,
            reference: row[:receipt_number],
            notes: row[:payment_notes]
          }
        ]

        refund_amount_cents = row[:refund_amount_cents].to_i
        return rows unless row[:payment_status] == "refunded" && refund_amount_cents.positive?

        rows << {
          type: "registration_refund",
          name: row[:name],
          detail: row[:partner_name].present? ? "Refund for team with #{row[:partner_name]}" : "Registration refund",
          payment_status: "refunded",
          payment_method: row[:payment_method],
          amount_cents: -refund_amount_cents,
          paid_at: row[:refunded_at] || paid_at,
          reference: row[:receipt_number],
          notes: row[:refund_reason]
        }
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
