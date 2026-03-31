class AddTshirtSizeToGolfers < ActiveRecord::Migration[8.0]
  def change
    add_column :golfers, :tshirt_size, :string
    add_column :golfers, :partner_tshirt_size, :string
  end
end
