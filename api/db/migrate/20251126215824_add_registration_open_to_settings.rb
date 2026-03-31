class AddRegistrationOpenToSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :settings, :registration_open, :boolean, default: true, null: false
  end
end
