class AddStripeSessionIdToGolfers < ActiveRecord::Migration[8.1]
  def change
    add_column :golfers, :stripe_checkout_session_id, :string
    add_column :golfers, :stripe_payment_intent_id, :string
    add_index :golfers, :stripe_checkout_session_id, unique: true, where: "stripe_checkout_session_id IS NOT NULL"
  end
end

