# frozen_string_literal: true

class AddCourseConfiguration < ActiveRecord::Migration[8.1]
  def change
    # Course configuration for tournaments
    add_column :tournaments, :course_name, :string
    add_column :tournaments, :total_holes, :integer, default: 18
    
    # JSONB for hole pars: { "1": 4, "2": 5, "3": 3, ... }
    add_column :tournaments, :hole_pars, :jsonb, default: {}
    
    # JSONB for hole handicaps (difficulty): { "1": 7, "2": 1, ... }
    add_column :tournaments, :hole_handicaps, :jsonb, default: {}
    
    # Tee configuration
    add_column :tournaments, :tee_name, :string  # e.g., "Blue", "White"
    add_column :tournaments, :course_rating, :decimal, precision: 4, scale: 1
    add_column :tournaments, :slope_rating, :integer
    
    # Computed fields for leaderboard
    add_column :tournaments, :total_par, :integer  # Sum of all hole pars
  end
end
