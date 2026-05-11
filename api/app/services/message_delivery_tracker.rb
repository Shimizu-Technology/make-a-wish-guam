# frozen_string_literal: true

class MessageDeliveryTracker
  class << self
    def create!(provider:, channel:, purpose:, recipient:, tournament: nil, messageable: nil, request_payload: {}, metadata: {})
      MessageDelivery.create!(
        provider: provider,
        channel: channel,
        purpose: purpose,
        recipient: recipient,
        tournament: tournament,
        messageable: messageable,
        request_payload: request_payload || {},
        metadata: metadata || {},
        status: "pending"
      )
    end

    def track_result!(delivery, result)
      return result if delivery.blank?

      normalized = normalize_result(result)
      delivery.mark_from_result!(normalized)
      normalized
    rescue => e
      Rails.logger.error("[MessageDeliveryTracker] failed to update delivery #{delivery&.id}: #{e.message}")
      result
    end

    def normalize_result(result)
      return { success: false, skipped: true, status: "skipped", error: "Delivery service not configured" } if result.nil?

      normalized = result.to_h.with_indifferent_access
      status = normalized[:status].presence || (normalized[:success] ? "accepted" : "failed")
      normalized.merge(status: MessageDelivery.normalize_status(status))
    end
  end
end
