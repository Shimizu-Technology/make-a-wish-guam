class AddPaidAtToGolfers < ActiveRecord::Migration[8.1]
  def up
    add_column :golfers, :paid_at, :datetime
    add_index :golfers, :paid_at
    
    # Backfill: Set paid_at to updated_at for existing paid golfers
    # Since tournament hasn't happened yet, all these are pre-paid
    execute <<-SQL
      UPDATE golfers 
      SET paid_at = updated_at 
      WHERE payment_status = 'paid' AND paid_at IS NULL
    SQL
  end
  
  def down
    remove_index :golfers, :paid_at
    remove_column :golfers, :paid_at
  end
end
