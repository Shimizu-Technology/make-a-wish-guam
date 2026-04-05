class FixOrgWebsiteAndSeedHomepageSettings < ActiveRecord::Migration[8.0]
  def up
    org = Organization.find_by(slug: 'make-a-wish-guam')
    return unless org

    org.update_columns(
      website_url: 'https://wish.org/guamcnmi',
      settings: (org.settings || {}).merge(
        'homepage_tagline' => 'Granting wishes since 1988',
        'homepage_mission' => 'Together we create life-changing wishes for children with critical illnesses',
        'homepage_stats' => [
          { 'value' => '38+', 'label' => 'Years granting wishes' },
          { 'value' => '100s', 'label' => 'Wishes granted in Guam' },
          { 'value' => 'May 2', 'label' => 'Golf for Wishes' }
        ]
      )
    )
  end

  def down
    # no-op
  end
end
