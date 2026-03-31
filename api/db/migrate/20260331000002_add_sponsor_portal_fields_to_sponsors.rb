class AddSponsorPortalFieldsToSponsors < ActiveRecord::Migration[8.0]
  def change
    add_column :sponsors, :login_email, :string
    add_column :sponsors, :access_token, :string
    add_column :sponsors, :access_token_expires_at, :datetime
    add_column :sponsors, :slot_count, :integer, default: 0
    add_index :sponsors, :access_token, unique: true, where: "access_token IS NOT NULL"
  end
end
