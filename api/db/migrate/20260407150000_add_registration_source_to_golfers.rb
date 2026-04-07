class AddRegistrationSourceToGolfers < ActiveRecord::Migration[8.1]
  def change
    add_column :golfers, :registration_source, :string, default: 'public'
  end
end
