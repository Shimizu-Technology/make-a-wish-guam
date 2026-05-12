# frozen_string_literal: true

class CreateMessageDeliveries < ActiveRecord::Migration[8.1]
  def change
    create_table :message_deliveries do |t|
      t.references :tournament, null: true, foreign_key: { on_delete: :nullify }
      t.references :messageable, polymorphic: true, null: true
      t.string :provider, null: false
      t.string :channel, null: false
      t.string :purpose, null: false
      t.string :recipient, null: false
      t.string :status, null: false, default: "pending"
      t.string :provider_message_id
      t.string :provider_status_code
      t.string :provider_status_text
      t.string :error_code
      t.text :error_text
      t.jsonb :request_payload, null: false, default: {}
      t.jsonb :response_payload, null: false, default: {}
      t.jsonb :metadata, null: false, default: {}
      t.datetime :last_event_at
      t.datetime :delivered_at
      t.datetime :failed_at

      t.timestamps
    end

    add_index :message_deliveries, :provider_message_id
    add_index :message_deliveries, [:provider, :provider_message_id]
    add_index :message_deliveries, [:purpose, :status]
    add_index :message_deliveries, [:recipient, :created_at]
  end
end
