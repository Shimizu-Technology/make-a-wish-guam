class CreateRaffleTickets < ActiveRecord::Migration[8.1]
  def change
    create_table :raffle_tickets do |t|
      t.references :tournament, null: false, foreign_key: true
      t.references :golfer, foreign_key: true  # Optional - can buy without being a golfer
      t.references :raffle_prize, foreign_key: true  # Assigned when drawn
      t.string :ticket_number, null: false
      t.string :purchaser_name
      t.string :purchaser_email
      t.string :purchaser_phone
      t.datetime :purchased_at
      t.integer :price_cents, default: 0
      t.string :payment_status, default: 'pending'  # pending, paid, refunded
      t.string :stripe_payment_intent_id
      t.boolean :is_winner, default: false
      t.datetime :drawn_at

      t.timestamps
    end

    add_index :raffle_tickets, :ticket_number, unique: true
    add_index :raffle_tickets, [:tournament_id, :payment_status]
    add_index :raffle_tickets, [:tournament_id, :is_winner]

    # Add FK for winning_ticket on raffle_prizes now that tickets table exists
    add_foreign_key :raffle_prizes, :raffle_tickets, column: :winning_ticket_id
  end
end
