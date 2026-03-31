class AddEmployeeFieldsToGolfersAndTournaments < ActiveRecord::Migration[8.1]
  def change
    # Add employee entry fee to tournaments (in cents)
    add_column :tournaments, :employee_entry_fee, :integer, default: 5000  # $50.00 default

    # Add employee fields to golfers
    add_column :golfers, :is_employee, :boolean, default: false, null: false
    add_column :golfers, :employee_number, :string
    add_reference :golfers, :employee_number_record, foreign_key: { to_table: :employee_numbers }, null: true
  end
end
