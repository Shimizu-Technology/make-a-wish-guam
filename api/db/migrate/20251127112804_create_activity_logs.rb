class CreateActivityLogs < ActiveRecord::Migration[8.1]
  def change
    create_table :activity_logs do |t|
      t.references :admin, null: true, foreign_key: true # null for system actions
      t.string :action, null: false
      t.string :target_type
      t.integer :target_id
      t.string :target_name
      t.text :details
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    # Indexes for common queries
    add_index :activity_logs, :action
    add_index :activity_logs, [:target_type, :target_id]
    add_index :activity_logs, :created_at
  end
end
