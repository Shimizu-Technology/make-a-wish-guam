# frozen_string_literal: true

class CreateRaffleSaleBatches < ActiveRecord::Migration[8.1]
  def change
    create_table :raffle_sale_batches do |t|
      t.references :tournament, null: false, foreign_key: true
      t.references :sold_by_user, foreign_key: { to_table: :users }
      t.string :buyer_name
      t.string :buyer_email
      t.string :buyer_phone
      t.integer :quantity, null: false, default: 0
      t.integer :total_cents, null: false, default: 0
      t.string :payment_method
      t.string :receipt_number
      t.text :payment_notes
      t.datetime :purchased_at

      t.timestamps
    end

    add_reference :raffle_tickets, :raffle_sale_batch, foreign_key: true
    add_index :raffle_sale_batches, [ :tournament_id, :purchased_at ]
  end
end
