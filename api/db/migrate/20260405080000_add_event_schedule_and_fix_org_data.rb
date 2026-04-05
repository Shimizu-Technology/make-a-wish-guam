class AddEventScheduleAndFixOrgData < ActiveRecord::Migration[8.0]
  def up
    add_column :tournaments, :event_schedule, :text, if_not_exists: true

    # Fix organization website_url on production
    Organization.where(slug: 'make-a-wish-guam').update_all(
      website_url: 'https://wish.org/guamcnmi'
    )
  end

  def down
    remove_column :tournaments, :event_schedule, if_exists: true
  end
end
