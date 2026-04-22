class ResetMawStartingPositions < ActiveRecord::Migration[8.1]
  class MigrationOrganization < ActiveRecord::Base
    self.table_name = 'organizations'
  end

  class MigrationTournament < ActiveRecord::Base
    self.table_name = 'tournaments'
  end

  class MigrationGroup < ActiveRecord::Base
    self.table_name = 'groups'
  end

  COURSE_CONFIGS = [
    { 'key' => 'hibiscus', 'name' => 'Hibiscus', 'hole_count' => 9 },
    { 'key' => 'bouganvillea', 'name' => 'Bouganvillea', 'hole_count' => 9 }
  ].freeze

  def up
    organization_id = MigrationOrganization.where(slug: 'make-a-wish-guam').pick(:id)
    return unless organization_id

    tournament = MigrationTournament.find_by(
      organization_id: organization_id,
      slug: 'golf-for-wishes-2026'
    )
    return unless tournament

    config = (tournament.config || {}).deep_stringify_keys
    config['course_configs'] = COURSE_CONFIGS

    MigrationTournament.where(id: tournament.id).update_all(
      config: config,
      total_holes: 18,
      updated_at: Time.current
    )

    MigrationGroup.where(tournament_id: tournament.id).update_all(
      starting_course_key: nil,
      hole_number: nil,
      updated_at: Time.current
    )
  end

  def down
    raise ActiveRecord::IrreversibleMigration, 'Cleared starting positions cannot be restored automatically'
  end
end
