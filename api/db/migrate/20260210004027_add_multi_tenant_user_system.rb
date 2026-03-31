class AddMultiTenantUserSystem < ActiveRecord::Migration[8.0]
  def change
    # Rename admins to users (role column already exists)
    rename_table :admins, :users
    
    # Update role default if needed (role column already exists from admins table)
    change_column_default :users, :role, from: nil, to: 'org_admin'
    
    # Create organization memberships join table
    create_table :organization_memberships, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :bigint
      t.references :organization, null: false, foreign_key: true, type: :uuid
      t.string :role, default: 'member'  # admin or member
      
      t.timestamps
    end
    
    add_index :organization_memberships, [:user_id, :organization_id], unique: true
    
    # Create tournament_assignments for tournament-level access
    create_table :tournament_assignments, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :bigint
      t.references :tournament, null: false, foreign_key: true, type: :bigint
      
      t.timestamps
    end
    
    add_index :tournament_assignments, [:user_id, :tournament_id], unique: true
  end
end
