class AddPositionToGolfers < ActiveRecord::Migration[8.1]
  def change
    add_column :golfers, :position, :integer
  end
end
