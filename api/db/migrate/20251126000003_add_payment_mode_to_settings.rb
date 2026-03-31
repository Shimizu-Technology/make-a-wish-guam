class AddPaymentModeToSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :settings, :payment_mode, :string, default: 'test'
    # 'test' = simulated payments (no Stripe calls)
    # 'production' = real Stripe payments
  end
end

