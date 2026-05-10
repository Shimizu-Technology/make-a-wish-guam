class AddEventTypeToTournaments < ActiveRecord::Migration[8.1]
  def change
    add_column :tournaments, :event_type, :string, null: false, default: "golf_tournament"
    add_index :tournaments, :event_type
  end
end
