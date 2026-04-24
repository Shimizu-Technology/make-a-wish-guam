class AddCourseKeyToSponsorsAndStartSlotCapacity < ActiveRecord::Migration[8.1]
  class MigrationOrganization < ActiveRecord::Base
    self.table_name = "organizations"
  end

  class MigrationTournament < ActiveRecord::Base
    self.table_name = "tournaments"
  end

  class MigrationSponsor < ActiveRecord::Base
    self.table_name = "sponsors"
  end

  def up
    add_column :sponsors, :course_key, :string
    add_index :sponsors, [:tournament_id, :course_key, :hole_number]

    configure_make_a_wish_start_slot_capacity
    backfill_sponsor_course_keys
  end

  def down
    remove_index :sponsors, column: [:tournament_id, :course_key, :hole_number]
    remove_column :sponsors, :course_key
  end

  private

  def configure_make_a_wish_start_slot_capacity
    organization_id = MigrationOrganization.where(slug: "make-a-wish-guam").pick(:id)
    return unless organization_id

    tournament = MigrationTournament.find_by(
      organization_id: organization_id,
      slug: "golf-for-wishes-2026"
    )
    return unless tournament

    config = (tournament.config || {}).deep_stringify_keys
    config["teams_per_start_position"] = 2

    MigrationTournament.where(id: tournament.id).update_all(
      config: config,
      updated_at: Time.current
    )
  end

  def backfill_sponsor_course_keys
    MigrationTournament.find_each do |tournament|
      course_configs = normalized_course_configs_for(tournament)
      next if course_configs.empty?

      hole_sponsors = MigrationSponsor.where(tournament_id: tournament.id, tier: "hole")
                                      .order(:hole_number, :position, :id)
                                      .to_a
      next if hole_sponsors.empty?

      hole_sponsors.group_by(&:hole_number).each do |legacy_hole_number, sponsors_at_hole|
        sponsors_at_hole.each_with_index do |sponsor, duplicate_index|
          mapped_course_key, mapped_hole_number =
            map_legacy_hole_assignment(
              legacy_hole_number: legacy_hole_number,
              duplicate_index: duplicate_index,
              course_configs: course_configs
            )

          sponsor.update_columns(
            course_key: mapped_course_key,
            hole_number: mapped_hole_number,
            updated_at: Time.current
          )
        end
      end
    end
  end

  def normalized_course_configs_for(tournament)
    raw = tournament.config.is_a?(Hash) ? tournament.config.deep_stringify_keys["course_configs"] : nil
    entries = Array(raw).filter_map do |entry|
      next unless entry.respond_to?(:to_h)

      data = entry.to_h.stringify_keys
      key = data["key"].to_s.strip
      name = data["name"].to_s.strip
      hole_count = data["hole_count"].to_i
      next if key.blank? || name.blank? || hole_count <= 0

      {
        "key" => key,
        "name" => name,
        "hole_count" => hole_count
      }
    end

    return entries if entries.present?

    [{
      "key" => "course-1",
      "name" => "Course",
      "hole_count" => [tournament.total_holes.to_i, 1].max
    }]
  end

  def map_legacy_hole_assignment(legacy_hole_number:, duplicate_index:, course_configs:)
    return [course_configs.first["key"], nil] if legacy_hole_number.blank?

    local_hole_limit = course_configs.map { |course| course["hole_count"].to_i }.min

    if duplicate_index.positive? && legacy_hole_number.to_i <= local_hole_limit
      course = course_configs[duplicate_index % course_configs.length]
      return [course["key"], legacy_hole_number]
    end

    remaining_hole_number = legacy_hole_number.to_i
    course_configs.each do |course|
      hole_count = course["hole_count"].to_i
      if remaining_hole_number <= hole_count
        return [course["key"], remaining_hole_number]
      end

      remaining_hole_number -= hole_count
    end

    fallback_course = course_configs.first
    fallback_hole_number = [legacy_hole_number.to_i, fallback_course["hole_count"].to_i].min
    [fallback_course["key"], fallback_hole_number]
  end
end
