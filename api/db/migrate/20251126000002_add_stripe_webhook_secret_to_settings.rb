class AddStripeWebhookSecretToSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :settings, :stripe_webhook_secret, :string
    add_column :settings, :tournament_entry_fee, :integer, default: 12500 # $125.00 in cents
  end
end

