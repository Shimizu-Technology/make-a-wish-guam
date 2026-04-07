# frozen_string_literal: true

class AddRaffleTicketRequestToGolfers < ActiveRecord::Migration[8.1]
  def change
    add_column :golfers, :raffle_tickets_requested, :integer, default: 0, null: false
    add_column :golfers, :raffle_bundle_label, :string
  end
end
