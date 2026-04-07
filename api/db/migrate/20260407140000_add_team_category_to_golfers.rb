class AddTeamCategoryToGolfers < ActiveRecord::Migration[7.1]
  def change
    add_column :golfers, :team_category, :string
  end
end
