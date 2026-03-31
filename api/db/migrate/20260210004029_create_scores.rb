# frozen_string_literal: true

class CreateScores < ActiveRecord::Migration[8.1]
  def change
    create_table :scores do |t|
      t.references :tournament, null: false, foreign_key: true
      t.references :golfer, foreign_key: true  # nullable for team scores
      t.references :group, null: false, foreign_key: true
      t.integer :hole, null: false
      t.integer :strokes, null: false
      t.integer :par  # Will be filled from hole config
      t.integer :relative_score  # Computed: strokes - par
      t.references :entered_by, foreign_key: { to_table: :users }  # Who entered the score
      t.boolean :verified, default: false
      t.datetime :verified_at
      t.text :notes
      t.string :score_type, default: 'individual'  # individual, team, gross, net

      t.timestamps
    end

    # Indices for efficient queries
    add_index :scores, [:tournament_id, :group_id, :hole]
    add_index :scores, [:tournament_id, :golfer_id]
    add_index :scores, [:tournament_id, :hole]
    add_index :scores, :score_type
  end
end
