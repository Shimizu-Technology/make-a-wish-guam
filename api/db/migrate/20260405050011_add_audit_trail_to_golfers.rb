class AddAuditTrailToGolfers < ActiveRecord::Migration[8.1]
  def change
    add_column :golfers, :payment_verified_by_id, :integer, if_not_exists: true
    add_column :golfers, :payment_verified_at, :datetime, if_not_exists: true
    add_column :golfers, :payment_verified_by_name, :string, if_not_exists: true
    add_column :golfers, :checked_in_by_id, :integer, if_not_exists: true
    add_column :golfers, :checked_in_by_name, :string, if_not_exists: true

    add_index :golfers, :payment_verified_at, if_not_exists: true
  end
end
