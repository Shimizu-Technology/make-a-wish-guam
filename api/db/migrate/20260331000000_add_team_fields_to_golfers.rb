class AddTeamFieldsToGolfers < ActiveRecord::Migration[8.0]
  def change
    add_column :golfers, :partner_name, :string
    add_column :golfers, :partner_email, :string
    add_column :golfers, :partner_phone, :string
    add_column :golfers, :partner_waiver_accepted_at, :datetime
    add_column :golfers, :team_name, :string
    add_column :golfers, :is_team_captain, :boolean, default: true
  end
end
