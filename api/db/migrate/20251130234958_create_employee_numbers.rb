class CreateEmployeeNumbers < ActiveRecord::Migration[8.1]
  def change
    create_table :employee_numbers do |t|
      t.references :tournament, null: false, foreign_key: true
      t.string :employee_number, null: false
      t.string :employee_name  # Optional - for admin reference
      t.boolean :used, default: false, null: false
      t.references :used_by_golfer, foreign_key: { to_table: :golfers }, null: true

      t.timestamps
    end

    # Unique constraint: each employee number can only exist once per tournament
    add_index :employee_numbers, [:tournament_id, :employee_number], unique: true
  end
end
