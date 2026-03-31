class SettingSerializer < ActiveModel::Serializer
  # Only global settings - tournament-specific settings are in Tournament model
  attributes :id, :stripe_public_key, :stripe_secret_key,
             :stripe_webhook_secret, :admin_email, :payment_mode,
             :stripe_configured, :test_mode, :created_at, :updated_at

  def stripe_configured
    object.stripe_configured?
  end

  def test_mode
    object.test_mode?
  end

  # Hide secret keys by default, only shown to authorized admins
  def stripe_secret_key
    if instance_options[:hide_secrets]
      nil
    else
      object.stripe_secret_key
    end
  end

  def stripe_webhook_secret
    if instance_options[:hide_secrets]
      nil
    else
      object.stripe_webhook_secret
    end
  end
end
