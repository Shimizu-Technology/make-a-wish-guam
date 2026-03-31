# frozen_string_literal: true

namespace :demo do
  desc "Seed Make-A-Wish Guam demo data (org, tournament, sponsors, golfers, scores)"
  task seed_maw: :environment do
    puts "Seeding Make-A-Wish Guam & CNMI demo data..."

    # =========================================================================
    # Organization
    # =========================================================================
    org = Organization.find_or_create_by!(slug: 'make-a-wish-guam') do |o|
      o.name = 'Make-A-Wish Guam & CNMI'
      o.description = 'Together, we create life-changing wishes for children with critical illnesses. Make-A-Wish Guam & CNMI has been granting wishes since 1988, bringing hope and joy to families across our islands.'
      o.primary_color = '#0057B8'
      o.contact_email = 'guamcnmi@wish.org'
      o.contact_phone = '671-649-9474'
      o.website_url = 'https://wish.org/guamcnmi'
    end

    # Update in case org already existed with old values
    org.update!(
      name: 'Make-A-Wish Guam & CNMI',
      description: 'Together, we create life-changing wishes for children with critical illnesses. Make-A-Wish Guam & CNMI has been granting wishes since 1988, bringing hope and joy to families across our islands.',
      primary_color: '#0057B8',
      contact_email: 'guamcnmi@wish.org',
      contact_phone: '671-649-9474',
      website_url: 'https://wish.org/guamcnmi'
    )
    puts "  - Organization: #{org.name} (#{org.slug})"

    # Add admin user
    admin = User.find_by(email: 'jerry.shimizutechnology@gmail.com')
    org.add_admin(admin) if admin
    puts "  - Admin linked" if admin

    # =========================================================================
    # Tournament: Golf for Wishes 2026
    # =========================================================================
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
      entry_fee: 15000, # $150 per registrant ($300 per 2-person team, per Make-A-Wish page)
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
      contact_name: 'Eric Tydingco, VP Programs',
      contact_phone: '671-649-9474',
      format_name: 'Two-Person Scramble'
    )
    tournament.save!

    # Remove old tournament if it exists
    old = Tournament.find_by(organization: org, slug: 'wishes-on-the-green-2026')
    old&.destroy if old && old.id != tournament.id

    puts "  - Tournament: #{tournament.name}"

    # =========================================================================
    # Sponsors
    # =========================================================================
    tournament.sponsors.destroy_all

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
      Sponsor.create!(
        tournament: tournament,
        name: s[:name],
        tier: s[:tier],
        website_url: s[:website_url]
      )
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
      Sponsor.create!(
        tournament: tournament,
        name: s[:name],
        tier: 'hole',
        hole_number: s[:hole_number]
      )
    end
    puts "  - #{sponsors_data.length + hole_sponsors_data.length} sponsors created"

    # =========================================================================
    # Golfers (24 demo registrations — two-person scramble teams)
    # =========================================================================
    tournament.golfers.destroy_all

    golfers_data = [
      ["John Santos", "Bank of Guam"], ["Maria Cruz", "Bank of Guam"],
      ["David Tydingco", "Docomo Pacific"], ["Sarah Kim", "Docomo Pacific"],
      ["Robert Flores", "Triple J Auto"], ["Jennifer Ada", "Triple J Auto"],
      ["Michael Reyes", "IT&E"], ["Lisa Bautista", "IT&E"],
      ["James Perez", nil], ["Anna Tenorio", nil],
      ["Chris Borja", "Matson"], ["Michelle Camacho", "Matson"],
      ["Daniel Guerrero", "Island Insurance"], ["Karen Pangelinan", nil],
      ["Mark Manibusan", "Hyatt Regency"], ["Emily Duenas", nil],
      ["Ryan Sablan", nil], ["Nicole Charfauros", nil],
      ["Kevin Leon Guerrero", "Ambros Inc"], ["Amy Quitugua", nil],
      ["Brian Taimanglo", nil], ["Christine Unpingco", "Staywell"],
      ["Tony Shimizu", nil], ["Grace Aguon", nil],
    ]

    golfers_data.each_with_index do |(name, company), i|
      Golfer.create!(
        tournament: tournament,
        name: name,
        email: "golfer#{i + 1}@example.com",
        phone: "671-555-#{(200 + i).to_s.rjust(4, '0')}",
        company: company,
        registration_status: 'confirmed',
        payment_status: 'paid',
        payment_type: 'stripe',
        waiver_accepted_at: Time.current
      )
    end
    puts "  - #{golfers_data.length} golfers registered"

    # =========================================================================
    # Groups & Scores (12 teams of 2, scramble format)
    # =========================================================================
    tournament.scores.destroy_all
    tournament.groups.destroy_all

    pars = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4]

    team_adjustments = {
      1  => [0, -1, -1, 0, -1, -1, 0, -1, 0, 0, -1, -1, 0, -1, 0, 0, -1, 0],   # -9
      2  => [0, -1, 0, 0, -1, -1, 0, -1, 0, -1, 0, -1, 0, 0, -1, 0, -1, 0],   # -8
      3  => [0, 0, -1, 0, -1, 0, 0, -1, -1, 0, -1, 0, 0, 0, -1, 0, -1, 0],    # -7
      4  => [0, 0, -1, 1, -1, 0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, -1, 0],      # -4
      5  => [-1, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, -1, 1, 0, 0, -1, 0, 0],       # -3
      6  => [0, 0, 0, 0, -1, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0],        # -2
      7  => [0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0],        # -3
      8  => [0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, 0],        # -3
      9  => [1, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0],        # -2
      10 => [0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, -1, 0, 0],         # -2
      11 => [0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0],         # -1
      12 => [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0],          #  0
    }
    holes_completed = { 1 => 18, 2 => 18, 3 => 18, 4 => 18, 5 => 16, 6 => 16, 7 => 15, 8 => 14, 9 => 13, 10 => 12, 11 => 10, 12 => 8 }

    golfers = tournament.golfers.confirmed.order(:id).to_a
    start_holes = [1, 1, 4, 4, 7, 7, 10, 10, 13, 13, 16, 16]

    12.times do |i|
      group = Group.create!(
        tournament: tournament,
        group_number: i + 1,
        hole_number: start_holes[i]
      )

      # Assign 2 golfers per team
      2.times do |j|
        idx = (i * 2) + j
        next if idx >= golfers.length
        golfers[idx].update!(group: group)
      end

      # Create scores
      completed = holes_completed[i + 1]
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
    puts "  - 12 teams with scores created"

    # =========================================================================
    # Raffle Prizes
    # =========================================================================
    tournament.raffle_prizes.destroy_all

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
    puts "  - #{raffle_prizes.length} raffle prizes created"

    # Give each golfer raffle tickets (included with registration)
    tournament.raffle_tickets.destroy_all
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
    puts "  - Raffle tickets assigned to all golfers"

    puts "\nGolf for Wishes 2026 demo data seeded successfully!"
    puts "   Visit: /make-a-wish-guam"
  end
end
