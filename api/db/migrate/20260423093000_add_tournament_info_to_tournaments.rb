class AddTournamentInfoToTournaments < ActiveRecord::Migration[8.1]
  def change
    add_column :tournaments, :tournament_info, :text
  end
end
