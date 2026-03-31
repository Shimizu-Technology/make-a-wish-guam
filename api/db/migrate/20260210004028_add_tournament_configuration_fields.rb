# frozen_string_literal: true

class AddTournamentConfigurationFields < ActiveRecord::Migration[8.1]
  def change
    change_table :tournaments, bulk: true do |t|
      # Tournament format and scoring (use tournament_format to avoid Ruby reserved word)
      t.string :tournament_format, default: 'scramble'
      t.string :scoring_type, default: 'gross'
      t.integer :team_size, default: 4
      t.boolean :allow_partial_teams, default: false
      t.boolean :handicap_required, default: false
      t.integer :handicap_max

      # Flights/Divisions
      t.boolean :use_flights, default: false
      t.jsonb :flights_config, default: {}

      # Registration settings
      t.datetime :early_bird_deadline
      t.integer :early_bird_fee  # cents
      t.datetime :registration_deadline
      t.boolean :waitlist_enabled, default: true
      t.integer :waitlist_max

      # Payment settings
      t.text :payment_instructions
      t.boolean :allow_cash, default: true
      t.boolean :allow_check, default: true
      t.boolean :allow_card, default: true

      # Schedule
      t.string :check_in_time
      t.boolean :shotgun_start, default: true
      t.boolean :tee_times_enabled, default: false
      t.integer :tee_time_interval_minutes, default: 10

      # Extended settings (JSONB for flexibility)
      t.jsonb :config, default: {}
    end

    # Add indices
    add_index :tournaments, :tournament_format
    add_index :tournaments, :early_bird_deadline
    add_index :tournaments, :registration_deadline
  end
end
