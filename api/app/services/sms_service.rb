class SmsService
  CLICKSEND_USERNAME = ENV.fetch('CLICKSEND_USERNAME', nil)
  CLICKSEND_API_KEY = ENV.fetch('CLICKSEND_API_KEY', nil)
  FROM = 'GolfWishes'  # Max 11 chars for alphanumeric sender

  def self.configured?
    CLICKSEND_USERNAME.present? && CLICKSEND_API_KEY.present?
  end

  def self.send_sms(to:, message:)
    return { success: false, error: 'ClickSend not configured' } unless configured?
    return { success: false, error: 'Invalid phone' } if to.blank?

    # Ensure E.164 format
    phone = to.strip
    phone = "+#{phone}" unless phone.start_with?('+')

    begin
      ClickSendClient.configure do |config|
        config.username = CLICKSEND_USERNAME
        config.api_key = CLICKSEND_API_KEY
      end

      api = ClickSendClient::SMSApi.new
      msg = ClickSendClient::SmsMessage.new
      msg.source = 'sdk'
      msg.body = message
      msg.to = phone
      msg.from = FROM

      collection = ClickSendClient::SmsMessageCollection.new
      collection.messages = [msg]

      response = api.sms_send_post(collection)
      Rails.logger.info("ClickSend SMS sent to #{phone}: #{response}")
      { success: true }
    rescue => e
      Rails.logger.error("ClickSend SMS failed to #{phone}: #{e.message}")
      { success: false, error: e.message }
    end
  end

  def self.send_registration_confirmation(golfer)
    return unless golfer.phone.present?

    tournament = golfer.tournament
    message = "You're registered for #{tournament.name}! " \
              "#{tournament.event_date} at #{tournament.location_name}. " \
              "Check-in: #{tournament.registration_time}. " \
              "Questions? Call 671-649-9474."

    send_sms(to: golfer.phone, message: message)

    # Also SMS partner if they have a different phone
    if golfer.partner_phone.present? && golfer.partner_phone != golfer.phone
      partner_message = "#{golfer.name} registered you for #{tournament.name}! " \
                       "#{tournament.event_date} at #{tournament.location_name}. " \
                       "Check-in: #{tournament.registration_time}."
      send_sms(to: golfer.partner_phone, message: partner_message)
    end
  end
end
