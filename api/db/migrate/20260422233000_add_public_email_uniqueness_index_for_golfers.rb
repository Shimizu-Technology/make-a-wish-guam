class AddPublicEmailUniquenessIndexForGolfers < ActiveRecord::Migration[8.1]
  def change
    add_index :golfers, [:tournament_id, :email],
      unique: true,
      where: "COALESCE(registration_source, 'public') != 'admin' AND registration_status IS DISTINCT FROM 'cancelled'",
      name: "index_golfers_on_tournament_id_and_email_public_unique"
  end
end
