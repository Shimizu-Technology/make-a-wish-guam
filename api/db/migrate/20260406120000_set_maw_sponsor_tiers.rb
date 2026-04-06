class SetMawSponsorTiers < ActiveRecord::Migration[8.1]
  def up
    tournament = Tournament.find_by(slug: 'golf-for-wishes-2026')
    return unless tournament

    tiers = [
      { 'key' => 'presenting',   'label' => 'Presenting Sponsor',   'sort_order' => 0 },
      { 'key' => 'premiere',     'label' => 'Premiere Sponsor',     'sort_order' => 1 },
      { 'key' => 'hole',         'label' => 'Hole Sponsor',         'sort_order' => 2 },
      { 'key' => 'hole_in_one',  'label' => 'Hole-In-One Sponsor',  'sort_order' => 3 }
    ]

    config = tournament.config || {}
    config['sponsor_tiers'] = tiers
    tournament.update_column(:config, config)

    # Re-map any existing sponsors from old tier keys to new ones
    mapping = {
      'title'    => 'presenting',
      'platinum' => 'presenting',
      'gold'     => 'premiere',
      'silver'   => 'premiere',
      'bronze'   => 'premiere',
    }

    tournament.sponsors.find_each do |sponsor|
      new_tier = mapping[sponsor.tier]
      sponsor.update_column(:tier, new_tier) if new_tier
    end
  end

  def down
    tournament = Tournament.find_by(slug: 'golf-for-wishes-2026')
    return unless tournament

    reverse_mapping = {
      'presenting'  => 'title',
      'premiere'    => 'gold',
      'hole_in_one' => 'hole',
    }

    tournament.sponsors.find_each do |sponsor|
      old_tier = reverse_mapping[sponsor.tier]
      sponsor.update_column(:tier, old_tier) if old_tier
    end

    config = tournament.config || {}
    config.delete('sponsor_tiers')
    tournament.update_column(:config, config)
  end
end
