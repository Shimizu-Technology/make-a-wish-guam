# frozen_string_literal: true

class SponsorAccessEmailService
  class << self
    def send_access_link(sponsor:, token:)
      return { success: false, error: "RESEND_API_KEY not configured" } unless ENV["RESEND_API_KEY"].present?

      mail = SponsorMailer.access_link(sponsor, token)
      from_email = ENV.fetch("MAILER_FROM_EMAIL", "noreply@shimizu-technology.com")
      tournament = sponsor.tournament
      delivery = MessageDeliveryTracker.create!(
        provider: "resend",
        channel: "email",
        purpose: "sponsor_portal_invite",
        recipient: sponsor.login_email,
        tournament: tournament,
        messageable: sponsor,
        request_payload: { from: from_email, to: sponsor.login_email, subject: mail.subject },
        metadata: { sponsor_id: sponsor.id, sponsor_name: sponsor.name }
      )

      response = Resend::Emails.send({
        from: from_email,
        to: sponsor.login_email,
        subject: mail.subject,
        html: html_body(mail),
        text: text_body(mail)
      }.compact)

      parsed = response.respond_to?(:parsed_response) ? response.parsed_response : response
      if parsed.is_a?(Hash) && (parsed["statusCode"] || parsed["error"] || parsed[:error])
        error_msg = parsed["message"] || parsed["error"] || parsed[:error] || "Unknown error"
        Rails.logger.error("[SponsorAccessEmail] failed for sponsor #{sponsor.id}: #{error_msg}")
        MessageDeliveryTracker.track_result!(delivery, { success: false, status: "failed", error: error_msg, data: parsed })
      else
        message_id = parsed.is_a?(Hash) ? (parsed["id"] || parsed[:id]) : nil
        Rails.logger.info("[SponsorAccessEmail] sent sponsor #{sponsor.id} invite to #{sponsor.login_email}: #{parsed}")
        MessageDeliveryTracker.track_result!(delivery, { success: true, status: "accepted", message_id: message_id, data: parsed })
      end
    rescue => e
      Rails.logger.error("[SponsorAccessEmail] failed for sponsor #{sponsor&.id}: #{e.class} #{e.message}")
      if defined?(delivery) && delivery.present?
        MessageDeliveryTracker.track_result!(delivery, { success: false, status: "failed", error: e.message })
      else
        { success: false, status: "failed", error: e.message }
      end
    end

    private

    def html_body(mail)
      part = mail.html_part
      return part.body.decoded if part.present?

      mail.body.decoded
    end

    def text_body(mail)
      mail.text_part&.body&.decoded
    end
  end
end
