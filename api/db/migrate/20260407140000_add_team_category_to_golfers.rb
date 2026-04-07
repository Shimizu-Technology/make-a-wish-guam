class AddTeamCategoryToGolfers < ActiveRecord::Migration[8.1]
  def change
    add_column :golfers, :team_category, :string
  end
end
