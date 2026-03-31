class AddPaymentTokenToGolfers < ActiveRecord::Migration[8.1]
  def change
    add_column :golfers, :payment_token, :string
    add_index :golfers, :payment_token, unique: true
  end
end
