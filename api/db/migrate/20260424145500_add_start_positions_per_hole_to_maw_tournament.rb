class AddStartPositionsPerHoleToMawTournament < ActiveRecord::Migration[8.1]
  def up
    organization = Organization.find_by(slug: "make-a-wish-guam")
    return unless organization

    tournament = organization.tournaments.find_by(slug: "golf-for-wishes-2026")
    return unless tournament

    config = (tournament.config || {}).deep_stringify_keys
    config["start_positions_per_hole"] = 2
    tournament.update_columns(config: config, updated_at: Time.current)
  end

  def down
    organization = Organization.find_by(slug: "make-a-wish-guam")
    return unless organization

    tournament = organization.tournaments.find_by(slug: "golf-for-wishes-2026")
    return unless tournament

    config = (tournament.config || {}).deep_stringify_keys
    config.delete("start_positions_per_hole")
    tournament.update_columns(config: config, updated_at: Time.current)
  end
end
