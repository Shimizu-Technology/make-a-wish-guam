class AddSponsorEditDeadlineToTournaments < ActiveRecord::Migration[8.1]
  def change
    add_column :tournaments, :sponsor_edit_deadline, :datetime
  end
end
