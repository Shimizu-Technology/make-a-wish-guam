class AddWalkinFieldsToTournaments < ActiveRecord::Migration[8.0]
  def change
    add_column :tournaments, :walkin_fee, :integer
    add_column :tournaments, :walkin_registration_open, :boolean, default: false
  end
end
