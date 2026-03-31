class CreateSettings < ActiveRecord::Migration[8.1]
  def change
    create_table :settings do |t|
      t.integer :max_capacity
      t.string :stripe_public_key
      t.string :stripe_secret_key
      t.string :admin_email

      t.timestamps
    end
  end
end
