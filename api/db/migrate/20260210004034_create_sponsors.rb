class CreateSponsors < ActiveRecord::Migration[8.1]
  def change
    create_table :sponsors do |t|
      t.references :tournament, null: false, foreign_key: true
      t.string :name, null: false
      t.string :tier, default: 'bronze'  # title, platinum, gold, silver, bronze, hole
      t.string :logo_url
      t.string :website_url
      t.text :description
      t.integer :hole_number  # For hole sponsors (1-18)
      t.integer :position, default: 0
      t.boolean :active, default: true

      t.timestamps
    end

    add_index :sponsors, [:tournament_id, :tier]
    add_index :sponsors, [:tournament_id, :hole_number]
    add_index :sponsors, [:tournament_id, :position]
  end
end
