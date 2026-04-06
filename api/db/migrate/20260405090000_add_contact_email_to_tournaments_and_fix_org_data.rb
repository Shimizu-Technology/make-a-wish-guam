class AddContactEmailToTournamentsAndFixOrgData < ActiveRecord::Migration[8.0]
  def up
    add_column :tournaments, :contact_email, :string, if_not_exists: true

    Organization.where(slug: 'make-a-wish-guam').update_all(
      contact_email: 'etydingco@guam.wish.org',
      contact_phone: '671-649-9474',
      website_url: 'https://wish.org/guamcnmi'
    )

    if (tournament = Tournament.joins(:organization).where(organizations: { slug: 'make-a-wish-guam' }, slug: 'golf-for-wishes-2026').first)
      tournament.update_columns(
        contact_name: 'Eric Tydingco',
        contact_email: 'etydingco@guam.wish.org'
      )
    end
  end

  def down
    remove_column :tournaments, :contact_email, if_exists: true
  end
end
