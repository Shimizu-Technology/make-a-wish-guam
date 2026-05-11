# frozen_string_literal: true

require "net/http"
require "uri"
require "json"
require "base64"

class ClicksendClient
  BASE_URL = "https://rest.clicksend.com/v3"

  class << self
    def send_sms(to:, body:, from: nil)
      username = ENV["CLICKSEND_USERNAME"]
      api_key  = ENV["CLICKSEND_API_KEY"]
      from   ||= ENV["CLICKSEND_SENDER_ID"] || "MAWGuam"

      if username.blank? || api_key.blank?
        Rails.logger.error("[ClicksendClient] Missing credentials — SMS not sent")
        return { success: false, error: "missing_credentials" }
      end

      from = from[0...11] if from.length > 11

      formatted_to = normalize_phone(to)
      encoded_body = body.gsub("$", "USD ")

      payload = {
        messages: [
          {
            source: "make_a_wish_guam",
            from: from,
            body: encoded_body,
            to: formatted_to
          }
        ]
      }

      Rails.logger.info("[ClicksendClient] Sending SMS to #{mask_phone(formatted_to)} (#{encoded_body.length} chars)")

      auth = Base64.strict_encode64("#{username}:#{api_key}")
      uri  = URI("#{BASE_URL}/sms/send")

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.open_timeout = 10
      http.read_timeout = 15

      request = Net::HTTP::Post.new(uri.request_uri, {
        "Authorization" => "Basic #{auth}",
        "Content-Type"  => "application/json"
      })
      request.body = payload.to_json

      begin
        response = http.request(request)
      rescue StandardError => e
        Rails.logger.error("[ClicksendClient] HTTP error: #{e.message}")
        return { success: false, error: e.message }
      end

      if response.code.to_i == 200
        json = JSON.parse(response.body) rescue {}
        result = normalize_send_response(json)
        if result[:success]
          Rails.logger.info("[ClicksendClient] Accepted SMS to #{mask_phone(formatted_to)} — ID: #{result[:message_id]}")
        else
          Rails.logger.error("[ClicksendClient] Message failed for #{mask_phone(formatted_to)} — #{result[:error]}")
        end
        result
      else
        Rails.logger.error("[ClicksendClient] HTTP #{response.code}: #{response.body}")
        { success: false, status: "failed", error: "http_#{response.code}", raw_response: response.body }
      end
    end

    def configured?
      ENV["CLICKSEND_USERNAME"].present? && ENV["CLICKSEND_API_KEY"].present?
    end

    def normalize_phone(phone)
      digits = phone.to_s.gsub(/\D/, "")
      digits = "1#{digits}" if digits.match?(/\A\d{10}\z/)
      digits = "+#{digits}" unless digits.start_with?("+")
      digits
    end

    def normalize_send_response(json)
      top_code = json["response_code"].to_s
      top_message = json["response_msg"].to_s
      message = Array(json.dig("data", "messages")).first || {}
      status_code = message["status_code"].presence || message["status"].presence
      status_text = message["status_text"].presence || message["response_msg"].presence || top_message
      message_id = message["message_id"].presence
      failure_text = [ top_code, top_message, status_code, status_text ].join(" ")
      success = top_code == "SUCCESS" && !MessageDelivery.failure_status_text?(failure_text)

      {
        success: success,
        status: success ? "accepted" : "failed",
        message_id: message_id,
        provider_status_code: status_code,
        provider_status_text: status_text,
        error: success ? nil : (status_text.presence || top_message.presence || top_code.presence || "ClickSend message failed"),
        data: json
      }.compact
    end

    def mask_phone(phone)
      return "unknown" if phone.blank?
      normalized = phone.to_s
      return "****" if normalized.length <= 4
      "#{'*' * (normalized.length - 4)}#{normalized[-4, 4]}"
    end
  end
end
