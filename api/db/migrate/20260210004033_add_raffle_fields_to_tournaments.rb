class AddRaffleFieldsToTournaments < ActiveRecord::Migration[8.1]
  def change
    add_column :tournaments, :raffle_enabled, :boolean, default: false
    add_column :tournaments, :raffle_ticket_price_cents, :integer, default: 500  # $5 default
    add_column :tournaments, :raffle_tickets_per_purchase, :integer, default: 1
    add_column :tournaments, :raffle_max_tickets_per_person, :integer
    add_column :tournaments, :raffle_draw_time, :datetime
    add_column :tournaments, :raffle_auto_draw, :boolean, default: false
    add_column :tournaments, :raffle_description, :text
  end
end
