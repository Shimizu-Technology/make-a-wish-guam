class AddRefundFieldsToGolfers < ActiveRecord::Migration[8.1]
  def change
    # Refund tracking fields
    add_column :golfers, :stripe_refund_id, :string
    add_column :golfers, :refund_amount_cents, :integer
    add_column :golfers, :refund_reason, :text
    add_column :golfers, :refunded_at, :datetime
    add_column :golfers, :refunded_by_id, :integer
    
    # Better payment details from Stripe
    add_column :golfers, :stripe_card_brand, :string  # e.g., "visa", "mastercard"
    add_column :golfers, :stripe_card_last4, :string  # e.g., "4242"
    add_column :golfers, :payment_amount_cents, :integer  # Amount actually paid
    
    # Add foreign key for refunded_by (references admins table)
    add_foreign_key :golfers, :admins, column: :refunded_by_id, on_delete: :nullify
    
    # Index for finding refunded golfers
    add_index :golfers, :stripe_refund_id, unique: true, where: "stripe_refund_id IS NOT NULL"
  end
end
