class CreateTournaments < ActiveRecord::Migration[8.1]
  def change
    create_table :tournaments do |t|
      t.string :name, null: false
      t.integer :year, null: false
      t.string :edition
      t.string :status, default: 'draft', null: false
      t.string :event_date
      t.string :registration_time
      t.string :start_time
      t.string :location_name
      t.string :location_address
      t.integer :max_capacity, default: 160
      t.integer :entry_fee, default: 12500
      t.string :format_name
      t.string :fee_includes
      t.string :checks_payable_to
      t.string :contact_name
      t.string :contact_phone
      t.boolean :registration_open, default: false, null: false

      t.timestamps
    end

    # Add indexes
    add_index :tournaments, :status
    add_index :tournaments, :year
    add_index :tournaments, [:status, :year]

    # Add tournament_id to related tables
    add_reference :golfers, :tournament, foreign_key: true, index: true
    add_reference :groups, :tournament, foreign_key: true, index: true
    add_reference :activity_logs, :tournament, foreign_key: true, index: true

    # Change golfer email uniqueness to be scoped by tournament
    remove_index :golfers, :email if index_exists?(:golfers, :email)
    add_index :golfers, [:tournament_id, :email], unique: true
  end
end
