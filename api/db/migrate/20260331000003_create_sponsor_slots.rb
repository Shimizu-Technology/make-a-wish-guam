class CreateSponsorSlots < ActiveRecord::Migration[8.0]
  def change
    create_table :sponsor_slots do |t|
      t.references :sponsor, null: false, foreign_key: true
      t.references :tournament, null: false, foreign_key: true
      t.integer :slot_number, null: false
      t.string :player_name
      t.string :player_email
      t.string :player_phone
      t.datetime :confirmed_at
      t.timestamps
    end
  end
end
