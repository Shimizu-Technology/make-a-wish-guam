class Setting < ApplicationRecord
  # Settings model now only stores GLOBAL settings (shared across all tournaments)
  # Tournament-specific settings (name, date, capacity, fee, etc.) are stored in Tournament model
  
  PAYMENT_MODES = %w[test production].freeze

  validates :payment_mode, inclusion: { in: PAYMENT_MODES }, allow_nil: true

  # Singleton pattern - only one settings record
  def self.instance
    first_or_create!(
      admin_email: nil,
      stripe_public_key: nil,
      stripe_secret_key: nil,
      stripe_webhook_secret: nil,
      payment_mode: 'test'
    )
  end

  def stripe_configured?
    stripe_public_key.present? && stripe_secret_key.present?
  end

  def test_mode?
    payment_mode == 'test' || payment_mode.nil?
  end

  def production_mode?
    payment_mode == 'production'
  end

  # Get admin emails as an array (supports comma-separated values)
  def admin_emails
    return [] unless admin_email.present?
    admin_email.split(',').map(&:strip).reject(&:blank?)
  end

  # Check if there are any admin emails configured
  def admin_emails?
    admin_emails.any?
  end
end
