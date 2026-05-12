# frozen_string_literal: true

class RaffleSmsService
  class << self
    def purchase_confirmation(tickets:, buyer_phone:, buyer_name:, tournament:, delivery: nil)
      return unless buyer_phone.present? && ClicksendClient.configured?

      ticket_numbers = tickets.map(&:display_number).join(", ")
      total_cents = tickets.sum(&:price_cents)
      total_dollars = "$#{'%.2f' % (total_cents / 100.0)}"
      org_name = tournament.organization&.name || "Make-A-Wish Guam & CNMI"

      body = "#{org_name} — #{tournament.name}\n\n" \
             "Hi #{buyer_name}! Your #{tickets.size} raffle ticket#{'s' if tickets.size != 1}:\n" \
             "#{ticket_numbers}\n\n" \
             "Total: #{total_dollars}\n\n" \
             "Hold on to these numbers — winners will be contacted by text or email. Good luck!"

      delivery ||= MessageDeliveryTracker.create!(
        provider: "clicksend",
        channel: "sms",
        purpose: "raffle_ticket_confirmation",
        recipient: buyer_phone,
        tournament: tournament,
        messageable: tickets.first,
        request_payload: { ticket_ids: tickets.map(&:id), ticket_numbers: ticket_numbers, body_chars: body.length },
        metadata: { buyer_name: buyer_name, ticket_count: tickets.size }
      )

      result = ClicksendClient.send_sms(to: buyer_phone, body: body)
      MessageDeliveryTracker.track_result!(delivery, result)
    rescue => e
      Rails.logger.error("[RaffleSmsService] purchase_confirmation failed: #{e.message}")
      result = { success: false, status: "failed", error: e.message }
      defined?(delivery) && delivery.present? ? MessageDeliveryTracker.track_result!(delivery, result) : result
    end

    def winner_notification(raffle_prize:, delivery: nil)
      ticket = raffle_prize.winning_ticket
      phone = raffle_prize.winner_phone.presence || ticket&.purchaser_phone
      return unless phone.present? && ClicksendClient.configured?

      tournament = raffle_prize.tournament
      org_name = tournament.organization&.name || "Make-A-Wish Guam & CNMI"

      body = "#{org_name} — #{tournament.name}\n\n" \
             "Congratulations #{raffle_prize.winner_name}! " \
             "Your raffle ticket ##{ticket&.display_number} was drawn as a winner!\n\n" \
             "You won: #{raffle_prize.name}"

      if raffle_prize.value_cents.to_i > 0
        body += " (Value: $#{'%.2f' % (raffle_prize.value_cents / 100.0)})"
      end

      body += "\n\nPlease contact the event organizers to claim your prize."

      if tournament.respond_to?(:contact_phone) && tournament.contact_phone.present?
        body += " Call/text: #{tournament.contact_phone}"
      end

      delivery ||= MessageDeliveryTracker.create!(
        provider: "clicksend",
        channel: "sms",
        purpose: "raffle_winner_notification",
        recipient: phone,
        tournament: tournament,
        messageable: raffle_prize,
        request_payload: { prize_id: raffle_prize.id, ticket_number: ticket&.display_number, body_chars: body.length },
        metadata: { winner_name: raffle_prize.winner_name }
      )

      result = ClicksendClient.send_sms(to: phone, body: body)
      MessageDeliveryTracker.track_result!(delivery, result)
    rescue => e
      Rails.logger.error("[RaffleSmsService] winner_notification failed: #{e.message}")
      result = { success: false, status: "failed", error: e.message }
      defined?(delivery) && delivery.present? ? MessageDeliveryTracker.track_result!(delivery, result) : result
    end
  end
end
