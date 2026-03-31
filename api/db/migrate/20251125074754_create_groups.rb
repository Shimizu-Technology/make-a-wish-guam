class CreateGroups < ActiveRecord::Migration[8.1]
  def change
    create_table :groups do |t|
      t.integer :group_number
      t.integer :hole_number

      t.timestamps
    end
  end
end
