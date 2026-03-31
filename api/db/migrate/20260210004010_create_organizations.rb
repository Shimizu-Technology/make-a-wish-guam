class CreateOrganizations < ActiveRecord::Migration[8.0]
  def change
    create_table :organizations, id: :uuid do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.string :logo_url
      t.string :primary_color, default: '#16a34a'  # Pacific Golf green
      t.string :banner_url
      t.text :description
      t.string :contact_email
      t.string :contact_phone
      t.string :website_url
      t.jsonb :settings, default: {}
      t.string :subscription_status, default: 'active'
      
      t.timestamps
    end
    
    add_index :organizations, :slug, unique: true
  end
end
