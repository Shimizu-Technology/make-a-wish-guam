class CreateRafflePrizes < ActiveRecord::Migration[8.1]
  def change
    create_table :raffle_prizes do |t|
      t.references :tournament, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.integer :value_cents, default: 0
      t.string :tier, default: 'standard' # grand, platinum, gold, silver, standard
      t.string :image_url
      t.string :sponsor_name
      t.string :sponsor_logo_url
      t.integer :position, default: 0
      t.boolean :won, default: false
      t.datetime :won_at
      t.string :winner_name
      t.string :winner_email
      t.string :winner_phone
      t.bigint :winning_ticket_id  # FK added after raffle_tickets table exists
      t.boolean :claimed, default: false
      t.datetime :claimed_at

      t.timestamps
    end

    add_index :raffle_prizes, [:tournament_id, :position]
    add_index :raffle_prizes, [:tournament_id, :tier]
  end
end
