class AddMagicLinkToGolfers < ActiveRecord::Migration[8.1]
  def change
    add_column :golfers, :magic_link_token, :string
    add_column :golfers, :magic_link_expires_at, :datetime
    add_index :golfers, :magic_link_token, unique: true, where: "magic_link_token IS NOT NULL"
  end
end
