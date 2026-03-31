class CreateAdmins < ActiveRecord::Migration[8.1]
  def change
    create_table :admins do |t|
      t.string :clerk_id
      t.string :name
      t.string :email
      t.string :role

      t.timestamps
    end
  end
end
