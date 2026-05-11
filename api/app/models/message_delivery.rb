# frozen_string_literal: true

class MessageDelivery < ApplicationRecord
  PROVIDERS = %w[resend clicksend action_mailer].freeze
  CHANNELS = %w[email sms].freeze
  STATUSES = %w[pending accepted delivered failed bounced delayed complained skipped].freeze

  belongs_to :tournament, optional: true
  belongs_to :messageable, polymorphic: true, optional: true

  validates :provider, presence: true, inclusion: { in: PROVIDERS }
  validates :channel, presence: true, inclusion: { in: CHANNELS }
  validates :purpose, presence: true
  validates :recipient, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  scope :recent, -> { order(created_at: :desc) }
  scope :failed, -> { where(status: %w[failed bounced complained]) }
  scope :open, -> { where(status: %w[pending accepted delayed]) }

  def mark_from_result!(result)
    normalized = result.to_h.with_indifferent_access
    update!(
      status: normalized[:status].presence || (normalized[:success] ? "accepted" : "failed"),
      provider_message_id: normalized[:message_id].presence || provider_message_id,
      provider_status_code: normalized[:provider_status_code].presence || normalized[:status_code].presence || provider_status_code,
      provider_status_text: normalized[:provider_status_text].presence || normalized[:status_text].presence || provider_status_text,
      error_code: normalized[:error_code].presence || error_code,
      error_text: normalized[:error].presence || normalized[:error_text].presence || error_text,
      response_payload: normalized[:data].presence || normalized[:raw_response].presence || response_payload,
      last_event_at: Time.current,
      delivered_at: delivered_status?(normalized[:status]) ? Time.current : delivered_at,
      failed_at: failed_status?(normalized[:status]) || normalized[:success] == false ? Time.current : failed_at
    )
  end

  def mark_skipped!(reason)
    update!(
      status: "skipped",
      error_text: reason,
      last_event_at: Time.current
    )
  end

  def apply_provider_event!(status:, provider_status_code: nil, provider_status_text: nil, error_code: nil, error_text: nil, payload: {})
    normalized_status = self.class.normalize_status(status)
    update!(
      status: normalized_status,
      provider_status_code: provider_status_code.presence || self.provider_status_code,
      provider_status_text: provider_status_text.presence || self.provider_status_text,
      error_code: error_code.presence || self.error_code,
      error_text: error_text.presence || self.error_text,
      response_payload: response_payload.merge("latest_event" => payload),
      last_event_at: Time.current,
      delivered_at: normalized_status == "delivered" ? Time.current : delivered_at,
      failed_at: failed_status?(normalized_status) ? Time.current : failed_at
    )
  end

  def self.normalize_status(status)
    value = status.to_s.downcase
    return "delivered" if value.match?(/delivered|received on handset/)
    return "accepted" if value.match?(/queued|sent|accepted|scheduled|success/)
    return "accepted" if value.match?(/\A20\d\z/)
    return "delayed" if value.match?(/delay|defer/)
    return "complained" if value.match?(/complain|spam/)

    case value
    when "sent", "queued", "success", "accepted", "scheduled"
      "accepted"
    when "delivered", "message delivered to the handset"
      "delivered"
    when "bounce", "bounced", "hard_bounce", "soft_bounce"
      "bounced"
    when "deferred", "delayed", "delivery_delayed"
      "delayed"
    when "complaint", "complained", "spam"
      "complained"
    when "skipped"
      "skipped"
    else
      failure_status_text?(value) ? "failed" : (STATUSES.include?(value) ? value : "failed")
    end
  end

  def self.failure_status_text?(text)
    text.to_s.match?(/fail|invalid|reject|bounce|undeliver|expired|blocked|unsubscribed|spam/i)
  end

  private

  def delivered_status?(status)
    self.class.normalize_status(status) == "delivered"
  end

  def failed_status?(status)
    %w[failed bounced complained].include?(self.class.normalize_status(status))
  end
end
