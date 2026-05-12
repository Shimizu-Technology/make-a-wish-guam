# frozen_string_literal: true

class AddRaffleDrawAuditFields < ActiveRecord::Migration[8.1]
  def change
    add_column :raffle_prizes, :draw_id, :string
    add_column :raffle_prizes, :draw_eligible_ticket_count, :integer
    add_column :raffle_prizes, :draw_preview_ticket_numbers, :jsonb, null: false, default: []

    add_index :raffle_prizes, :draw_id
  end
end
