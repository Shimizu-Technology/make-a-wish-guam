class AddPaymentTrackingToRaffleTickets < ActiveRecord::Migration[8.1]
  def change
    add_column :raffle_tickets, :payment_method, :string
    add_column :raffle_tickets, :receipt_number, :string
    add_column :raffle_tickets, :payment_notes, :text
  end
end
