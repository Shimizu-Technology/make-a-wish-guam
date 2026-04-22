class AllowDuplicateAdminEmailsForGolfers < ActiveRecord::Migration[8.1]
  def change
    remove_index :golfers, name: "index_golfers_on_tournament_id_and_email"
    add_index :golfers, [:tournament_id, :email], name: "index_golfers_on_tournament_id_and_email"
  end
end
