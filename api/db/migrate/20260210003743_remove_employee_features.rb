class RemoveEmployeeFeatures < ActiveRecord::Migration[8.0]
  def up
    # Remove foreign key constraint first
    if foreign_key_exists?(:golfers, :employee_numbers)
      remove_foreign_key :golfers, :employee_numbers
    end

    # Remove employee-related columns from golfers
    remove_column :golfers, :employee_number_record_id if column_exists?(:golfers, :employee_number_record_id)
    remove_column :golfers, :is_employee if column_exists?(:golfers, :is_employee)
    remove_column :golfers, :employee_number if column_exists?(:golfers, :employee_number)

    # Remove employee-related columns from tournaments
    remove_column :tournaments, :employee_entry_fee if column_exists?(:tournaments, :employee_entry_fee)

    # Drop employee_numbers table
    drop_table :employee_numbers, if_exists: true
  end

  def down
    # Re-create employee_numbers table
    create_table :employee_numbers do |t|
      t.references :tournament, null: false, foreign_key: true
      t.string :employee_number, null: false
      t.string :employee_name
      t.boolean :used, default: false, null: false
      t.references :used_by_golfer, foreign_key: { to_table: :golfers }
      t.timestamps
    end

    add_index :employee_numbers, [:tournament_id, :employee_number], unique: true

    # Add back employee columns to golfers
    add_column :golfers, :is_employee, :boolean, default: false, null: false
    add_column :golfers, :employee_number, :string
    add_reference :golfers, :employee_number_record, foreign_key: { to_table: :employee_numbers }

    # Add back employee_entry_fee to tournaments
    add_column :tournaments, :employee_entry_fee, :integer, default: 5000
  end
end
