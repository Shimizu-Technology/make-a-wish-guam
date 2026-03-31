# Configure Resend for email delivery
if ENV["RESEND_API_KEY"].present?
  Resend.api_key = ENV["RESEND_API_KEY"]

  # Configure Action Mailer to use Resend
  Rails.application.config.action_mailer.delivery_method = :resend
else
  Rails.logger.warn("RESEND_API_KEY not set - emails will not be sent")

  # Use letter_opener in development for testing emails without Resend
  if Rails.env.development?
    Rails.application.config.action_mailer.delivery_method = :test
  end
end

