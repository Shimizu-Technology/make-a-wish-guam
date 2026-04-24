class AddStartPositionsPerHoleToMawTournament < ActiveRecord::Migration[8.1]
  class MigrationOrganization < ActiveRecord::Base
    self.table_name = "organizations"
  end

  class MigrationTournament < ActiveRecord::Base
    self.table_name = "tournaments"
  end

  def up
    organization_id = MigrationOrganization.where(slug: "make-a-wish-guam").pick(:id)
    return unless organization_id

    tournament = MigrationTournament.find_by(
      organization_id: organization_id,
      slug: "golf-for-wishes-2026"
    )
    return unless tournament

    config = (tournament.config || {}).deep_stringify_keys
    config["start_positions_per_hole"] = 2
    MigrationTournament.where(id: tournament.id).update_all(
      config: config,
      updated_at: Time.current
    )
  end

  def down
    organization_id = MigrationOrganization.where(slug: "make-a-wish-guam").pick(:id)
    return unless organization_id

    tournament = MigrationTournament.find_by(
      organization_id: organization_id,
      slug: "golf-for-wishes-2026"
    )
    return unless tournament

    config = (tournament.config || {}).deep_stringify_keys
    config.delete("start_positions_per_hole")
    MigrationTournament.where(id: tournament.id).update_all(
      config: config,
      updated_at: Time.current
    )
  end
end
