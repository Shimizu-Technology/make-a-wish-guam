# frozen_string_literal: true

class RaffleSmsService
  class << self
    def purchase_confirmation(tickets:, buyer_phone:, buyer_name:, tournament:)
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

      ClicksendClient.send_sms(to: buyer_phone, body: body)
    rescue => e
      Rails.logger.error("[RaffleSmsService] purchase_confirmation failed: #{e.message}")
      { success: false, error: e.message }
    end

    def winner_notification(raffle_prize:)
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

      ClicksendClient.send_sms(to: phone, body: body)
    rescue => e
      Rails.logger.error("[RaffleSmsService] winner_notification failed: #{e.message}")
      { success: false, error: e.message }
    end
  end
end
