class ResetMawStartingPositions < ActiveRecord::Migration[8.1]
  COURSE_CONFIGS = [
    { 'key' => 'hibiscus', 'name' => 'Hibiscus', 'hole_count' => 9 },
    { 'key' => 'bouganvillea', 'name' => 'Bouganvillea', 'hole_count' => 9 }
  ].freeze

  def up
    organization = Organization.find_by(slug: 'make-a-wish-guam')
    return unless organization

    tournament = organization.tournaments.find_by(slug: 'golf-for-wishes-2026')
    return unless tournament

    config = (tournament.config || {}).deep_stringify_keys
    config['course_configs'] = COURSE_CONFIGS

    tournament.update_columns(
      config: config,
      total_holes: 18,
      updated_at: Time.current
    )

    tournament.groups.update_all(
      starting_course_key: nil,
      hole_number: nil,
      updated_at: Time.current
    )
  end

  def down
    raise ActiveRecord::IrreversibleMigration, 'Cleared starting positions cannot be restored automatically'
  end
end
