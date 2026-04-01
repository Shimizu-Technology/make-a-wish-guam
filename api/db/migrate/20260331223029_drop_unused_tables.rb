# frozen_string_literal: true

class DropUnusedTables < ActiveRecord::Migration[8.1]
  def up
    remove_foreign_key :golfers, :employee_numbers, column: :employee_number_record_id, if_exists: true
    remove_foreign_key :access_requests, :users, column: :reviewed_by_id, if_exists: true

    remove_column :golfers, :employee_number_record_id, if_exists: true
    remove_column :golfers, :employee_number, if_exists: true

    drop_table :employee_numbers, if_exists: true
    drop_table :access_requests, if_exists: true
  end

  def down
    create_table :access_requests do |t|
      t.string :contact_name, null: false
      t.string :email, null: false
      t.string :organization_name, null: false
      t.string :phone
      t.text :notes
      t.string :status, null: false, default: "new"
      t.string :source, null: false, default: "homepage"
      t.bigint :reviewed_by_id
      t.datetime :reviewed_at
      t.timestamps
    end
    add_index :access_requests, :email
    add_index :access_requests, :status
    add_index :access_requests, :created_at
    add_index :access_requests, :reviewed_by_id
    add_foreign_key :access_requests, :users, column: :reviewed_by_id, on_delete: :nullify

    create_table :employee_numbers do |t|
      t.string :employee_number, null: false
      t.string :employee_name
      t.bigint :tournament_id, null: false
      t.boolean :used, null: false, default: false
      t.bigint :used_by_golfer_id
      t.timestamps
    end
    add_index :employee_numbers, [:tournament_id, :employee_number], unique: true
    add_index :employee_numbers, :tournament_id
    add_index :employee_numbers, :used_by_golfer_id
    add_foreign_key :employee_numbers, :tournaments

    add_column :golfers, :employee_number, :string
    add_column :golfers, :employee_number_record_id, :bigint
    add_index :golfers, :employee_number_record_id
    add_foreign_key :golfers, :employee_numbers, column: :employee_number_record_id
  end
end
