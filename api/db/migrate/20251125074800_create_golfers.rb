class CreateGolfers < ActiveRecord::Migration[8.1]
  def change
    create_table :golfers do |t|
      t.string :name
      t.string :company
      t.string :address
      t.string :phone
      t.string :mobile
      t.string :email
      t.string :payment_type
      t.string :payment_status
      t.datetime :waiver_accepted_at
      t.datetime :checked_in_at
      t.string :registration_status
      t.references :group, null: false, foreign_key: true
      t.integer :hole_number
      t.text :notes
      t.string :payment_method
      t.string :receipt_number
      t.text :payment_notes

      t.timestamps
    end
  end
end
