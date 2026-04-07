# frozen_string_literal: true

class AddVoidFieldsToRaffleTickets < ActiveRecord::Migration[8.0]
  def change
    add_column :raffle_tickets, :voided_at, :datetime
    add_column :raffle_tickets, :void_reason, :string
  end
end
