# frozen_string_literal: true

# Make-A-Wish Guam & CNMI Seeds
# This is a single-org app — seeds create the MAW organization,
# Golf for Wishes tournament, sponsors, demo golfers, scores, and raffle prizes.

puts "Seeding Make-A-Wish Guam & CNMI..."

# =============================================================================
# Organization
# =============================================================================
org = Organization.find_or_create_by!(slug: 'make-a-wish-guam') do |o|
  o.name = 'Make-A-Wish Guam & CNMI'
  o.description = 'Together, we create life-changing wishes for children with critical illnesses. Make-A-Wish Guam & CNMI has been granting wishes since 1988, bringing hope and joy to families across our islands.'
  o.primary_color = '#0057B8'
  o.contact_email = 'etydingco@guam.wish.org'
  o.contact_phone = '671-649-9474'
  o.website_url = 'https://wish.org/guamcnmi'
end

org.update!(
  name: 'Make-A-Wish Guam & CNMI',
  description: 'Together, we create life-changing wishes for children with critical illnesses. Make-A-Wish Guam & CNMI has been granting wishes since 1988, bringing hope and joy to families across our islands.',
  primary_color: '#0057B8',
  contact_email: 'etydingco@guam.wish.org',
  contact_phone: '671-649-9474',
  website_url: 'https://wish.org/guamcnmi',
  settings: {
    'homepage_tagline' => 'Granting wishes since 1988',
    'homepage_mission' => 'Together we create life-changing wishes for children with critical illnesses',
    'homepage_stats' => [
      { 'value' => '38+', 'label' => 'Years granting wishes' },
      { 'value' => '100s', 'label' => 'Wishes granted in Guam' },
      { 'value' => 'May 2', 'label' => 'Golf for Wishes' }
    ]
  }
)
puts "  Organization: #{org.name} (#{org.slug})"

# =============================================================================
# Admin user
# =============================================================================
admin = User.find_or_create_by!(email: 'jerry.shimizutechnology@gmail.com') do |u|
  u.name = 'Jerry'
  u.role = 'super_admin'
end
org.add_admin(admin)
puts "  Super admin: #{admin.email}"

admin2 = User.find_or_create_by!(email: 'shimizutechnology@gmail.com') do |u|
  u.name = 'Leon'
  u.role = 'super_admin'
end
org.add_admin(admin2)
puts "  Super admin: #{admin2.email}"

# =============================================================================
# Settings (singleton)
# =============================================================================
Setting.find_or_create_by!(id: 1) do |s|
  s.stripe_public_key = ENV['STRIPE_PUBLISHABLE_KEY']
  s.stripe_secret_key = ENV['STRIPE_SECRET_KEY']
  s.payment_mode = 'test'
  s.admin_email = 'guamcnmi@wish.org'
end
puts "  Settings created"

# =============================================================================
# Tournament: Golf for Wishes 2026
# =============================================================================
tournament = Tournament.find_or_initialize_by(
  organization: org,
  slug: 'golf-for-wishes-2026'
)

tournament.assign_attributes(
  name: 'Golf for Wishes 2026',
  year: 2026,
  edition: '1st Annual',
  event_date: Date.new(2026, 5, 2),
  check_in_time: '7:00 AM',
  registration_time: '7:00 AM',
  start_time: '8:00 AM Shotgun Start',
  location_name: 'LeoPalace Resort Country Club',
  location_address: 'Yona, Guam',
  tournament_format: 'scramble',
  team_size: 2,
  entry_fee: 30000,
  max_capacity: 144,
  status: 'open',
  registration_open: true,
  raffle_enabled: true,
  total_holes: 18,
  total_par: 72,
  allow_card: true,
  allow_cash: true,
  allow_check: true,
  checks_payable_to: 'Make-A-Wish Foundation of Guam & CNMI',
  fee_includes: 'Green Fee, Cart, Lunch, Awards Banquet, and Raffle Entry',
  contact_name: 'Eric Tydingco',
  contact_phone: '671-649-9474',
  contact_email: 'etydingco@guam.wish.org',
  format_name: 'Two-Person Scramble',
  event_schedule: "7:00 AM — Check-in\n8:00 AM — Shotgun Start\n1:30 PM — Banquet & Awards",
  payment_instructions: 'Payment will be processed securely online after registration.'
)
tournament.save!
puts "  Tournament: #{tournament.name}"

# =============================================================================
# Sponsors
# =============================================================================
if tournament.sponsors.none?
  sponsors_data = [
    { name: 'Bank of Guam', tier: 'title', website_url: 'https://bankofguam.com' },
    { name: 'Docomo Pacific', tier: 'platinum', website_url: 'https://docomopacific.com' },
    { name: 'Triple J Auto Group', tier: 'platinum', website_url: 'https://triplejguam.com' },
    { name: 'IT&E', tier: 'gold', website_url: 'https://ite.net' },
    { name: 'Matson', tier: 'gold', website_url: 'https://matson.com' },
    { name: 'Hyatt Regency Guam', tier: 'gold', website_url: 'https://hyatt.com/hyatt-regency/guam' },
    { name: 'Coast 360 Federal Credit Union', tier: 'silver', website_url: 'https://coast360fcu.com' },
    { name: 'Guam Premier Outlets', tier: 'silver', website_url: 'https://gpoguam.com' },
    { name: 'Island Insurance', tier: 'bronze' },
    { name: 'Pacific Daily News', tier: 'bronze', website_url: 'https://guampdn.com' },
  ]

  sponsors_data.each do |s|
    Sponsor.create!(tournament: tournament, name: s[:name], tier: s[:tier], website_url: s[:website_url])
  end

  hole_sponsors_data = [
    { name: "Calvo's Insurance", hole_number: 1 },
    { name: "McDonald's of Guam", hole_number: 2 },
    { name: 'Pay-Less Supermarkets', hole_number: 3 },
    { name: 'Guam Reef Hotel', hole_number: 9 },
    { name: 'Ambros Inc', hole_number: 10 },
    { name: 'Staywell Health Plan', hole_number: 14 },
    { name: 'Hawaiian Rock Products', hole_number: 18 },
  ]

  hole_sponsors_data.each do |s|
    Sponsor.create!(tournament: tournament, name: s[:name], tier: 'hole', hole_number: s[:hole_number])
  end

  puts "  #{sponsors_data.length + hole_sponsors_data.length} sponsors created"
else
  puts "  Sponsors already exist, skipping"
end

# =============================================================================
# Demo Golfers (15 teams — each team is 1 registration with a partner)
# =============================================================================
if tournament.golfers.none?
  teams_data = [
    { name: "John Santos", partner: "Maria Cruz", company: "Bank of Guam" },
    { name: "David Tydingco", partner: "Sarah Kim", company: "Docomo Pacific" },
    { name: "Robert Flores", partner: "Jennifer Ada", company: "Triple J Auto" },
    { name: "Michael Reyes", partner: "Lisa Bautista", company: "IT&E" },
    { name: "James Perez", partner: "Anna Tenorio", company: nil },
    { name: "Chris Borja", partner: "Michelle Camacho", company: "Matson" },
    { name: "Daniel Guerrero", partner: "Karen Pangelinan", company: "Island Insurance" },
    { name: "Mark Manibusan", partner: "Emily Duenas", company: "Hyatt Regency" },
    { name: "Ryan Sablan", partner: "Nicole Charfauros", company: nil },
    { name: "Kevin Leon Guerrero", partner: "Amy Quitugua", company: "Ambros Inc" },
    { name: "Brian Taimanglo", partner: "Christine Unpingco", company: "Staywell" },
    { name: "Tony Shimizu", partner: "Grace Aguon", company: nil },
    { name: "Leon Test1", partner: "Leon Partner1", company: nil },
    { name: "Leon Test2", partner: "Leon Partner2", company: nil },
    { name: "Leon Test3", partner: "Leon Partner3", company: nil },
  ]

  teams_data.each_with_index do |team, i|
    is_paid = i < 13
    Golfer.create!(
      tournament: tournament,
      name: team[:name],
      partner_name: team[:partner],
      partner_email: "partner#{i + 1}@example.com",
      partner_phone: "671-555-#{(300 + i).to_s.rjust(4, '0')}",
      team_name: "#{team[:name]} & #{team[:partner]}",
      email: "golfer#{i + 1}@example.com",
      phone: "671-555-#{(200 + i).to_s.rjust(4, '0')}",
      company: team[:company],
      registration_status: 'confirmed',
      payment_status: is_paid ? 'paid' : 'unpaid',
      payment_type: 'swipe_simple',
      paid_at: is_paid ? Time.current : nil,
      payment_verified_at: is_paid ? Time.current : nil,
      payment_verified_by_name: is_paid ? 'System (Seed)' : nil,
      waiver_accepted_at: Time.current
    )
  end
  puts "  #{teams_data.length} demo teams registered (#{teams_data.count { |_, i| true }} teams)"
else
  puts "  Golfers already exist, skipping"
end

# =============================================================================
# Groups & Scores (1 team per group, scramble format)
# =============================================================================
if tournament.groups.none? && tournament.golfers.confirmed.any?
  pars = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4]

  team_adjustments = {
    1  => [0, -1, -1, 0, -1, -1, 0, -1, 0, 0, -1, -1, 0, -1, 0, 0, -1, 0],
    2  => [0, -1, 0, 0, -1, -1, 0, -1, 0, -1, 0, -1, 0, 0, -1, 0, -1, 0],
    3  => [0, 0, -1, 0, -1, 0, 0, -1, -1, 0, -1, 0, 0, 0, -1, 0, -1, 0],
    4  => [0, 0, -1, 1, -1, 0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, -1, 0],
    5  => [-1, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, -1, 1, 0, 0, -1, 0, 0],
    6  => [0, 0, 0, 0, -1, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0],
    7  => [0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0],
    8  => [0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, 0],
    9  => [1, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0],
    10 => [0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, -1, 0, 0],
  }
  holes_completed = { 1 => 18, 2 => 18, 3 => 18, 4 => 18, 5 => 16, 6 => 16, 7 => 15, 8 => 14, 9 => 13, 10 => 12 }

  paid_teams = tournament.golfers.confirmed.where(payment_status: 'paid').order(:id).to_a
  start_holes = [1, 1, 4, 4, 7, 7, 10, 10, 13, 13]

  paid_teams.first(10).each_with_index do |golfer, i|
    group = Group.create!(
      tournament: tournament,
      group_number: i + 1,
      hole_number: start_holes[i]
    )

    golfer.update!(group: group)

    completed = holes_completed[i + 1]
    next unless completed
    completed.times do |h|
      hole = h + 1
      strokes = pars[h] + team_adjustments[i + 1][h]

      Score.create!(
        tournament: tournament,
        group: group,
        hole: hole,
        score_type: 'team',
        strokes: strokes,
        par: pars[h],
        verified: true
      )
    end
  end
  puts "  #{paid_teams.first(10).length} teams with groups & scores created"
else
  puts "  Groups/scores already exist, skipping"
end

# =============================================================================
# Raffle Prizes
# =============================================================================
if tournament.raffle_prizes.none?
  raffle_prizes = [
    { name: 'Round Trip Airfare to Manila', description: 'United Airlines round-trip ticket', value_cents: 80000 },
    { name: 'Weekend Stay at Hyatt Regency Guam', description: '2-night ocean view stay', value_cents: 60000 },
    { name: 'Golf Club Set', description: 'Callaway Rogue ST Max iron set', value_cents: 90000 },
    { name: '$500 Gift Card - GPO', description: 'Shopping spree at Guam Premier Outlets', value_cents: 50000 },
    { name: 'Dinner for 4 at Proa', description: 'Fine dining experience', value_cents: 30000 },
    { name: 'Island Hopper Package', description: 'Day trip to Rota with snorkeling', value_cents: 40000 },
  ]

  raffle_prizes.each do |rp|
    RafflePrize.create!(
      tournament: tournament,
      name: rp[:name],
      description: rp[:description],
      value_cents: rp[:value_cents],
      won: false
    )
  end
  puts "  #{raffle_prizes.length} raffle prizes created"
else
  puts "  Raffle prizes already exist, skipping"
end

# =============================================================================
# Raffle Tickets (one per golfer, included with registration)
# =============================================================================
if tournament.raffle_tickets.none? && tournament.golfers.confirmed.any?
  tournament.golfers.confirmed.each do |golfer|
    RaffleTicket.create!(
      tournament: tournament,
      golfer: golfer,
      ticket_number: "MAW-#{golfer.id.to_s.rjust(4, '0')}",
      purchaser_name: golfer.name,
      purchaser_email: golfer.email,
      purchaser_phone: golfer.phone,
      payment_status: 'paid',
      purchased_at: Time.current
    )
  end
  puts "  Raffle tickets assigned to all golfers"
else
  puts "  Raffle tickets already exist, skipping"
end

puts "\nSeeding complete!"
puts "  Organization: #{org.name} (#{org.slug})"
puts "  Admin: #{admin.email} (#{admin.role})"
puts "  Tournament: #{tournament.name} (#{tournament.status})"
puts "  Sponsors: #{tournament.sponsors.count}"
puts "  Golfers: #{tournament.golfers.count}"
puts "  Raffle Prizes: #{tournament.raffle_prizes.count}"
