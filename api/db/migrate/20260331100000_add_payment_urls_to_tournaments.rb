class AddPaymentUrlsToTournaments < ActiveRecord::Migration[8.1]
  def change
    add_column :tournaments, :swipe_simple_url, :string
    add_column :tournaments, :walkin_swipe_simple_url, :string
    add_column :tournaments, :entry_fee_display, :string, default: '$300/team'
  end
end
