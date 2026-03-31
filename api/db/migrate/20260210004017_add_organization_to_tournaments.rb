class AddOrganizationToTournaments < ActiveRecord::Migration[8.0]
  def change
    # Add organization reference to tournaments
    add_reference :tournaments, :organization, type: :uuid, foreign_key: true
    
    # Add slug to tournaments for friendly URLs
    add_column :tournaments, :slug, :string
    add_index :tournaments, [:organization_id, :slug], unique: true
  end
end
