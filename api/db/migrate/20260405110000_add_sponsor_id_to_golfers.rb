class AddSponsorIdToGolfers < ActiveRecord::Migration[8.0]
  def change
    add_reference :golfers, :sponsor, null: true, foreign_key: true
    add_column :golfers, :sponsor_name, :string
  end
end
