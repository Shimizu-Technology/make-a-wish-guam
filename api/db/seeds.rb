# frozen_string_literal: true

# Make-A-Wish Guam Seeds
# Seeds for development and testing

puts "Seeding Make-A-Wish Guam database..."

# Create the MAW organization (single-org app)
org = Organization.find_or_create_by!(slug: 'make-a-wish-guam') do |o|
  o.name = 'Make-A-Wish Guam & CNMI'
  o.description = 'Granting wishes for children with critical illnesses in Guam and the CNMI.'
  o.primary_color = '#1e3a5f'
  o.contact_email = 'etydingco@guam.wish.org'
  o.contact_phone = '671-649-9474'
  o.website_url = 'https://wish.org/guam'
end
puts "  Created organization: #{org.name} (#{org.slug})"

# Create default admin user
admin = User.find_or_create_by!(email: 'jerry.shimizutechnology@gmail.com') do |u|
  u.name = 'Jerry'
  u.role = 'super_admin'
end
puts "  Created super admin: #{admin.email}"

# Add admin to the organization
org.add_admin(admin)
puts "  Added #{admin.email} to #{org.name}"

# Create settings (singleton)
Setting.find_or_create_by!(id: 1) do |s|
  s.stripe_public_key = ENV['STRIPE_PUBLISHABLE_KEY']
  s.stripe_secret_key = ENV['STRIPE_SECRET_KEY']
  s.payment_mode = 'test'
  s.admin_email = 'etydingco@guam.wish.org'
end
puts "  Created settings"

# Create the Golf for Wishes tournament
tournament = Tournament.find_or_create_by!(organization: org, name: 'Golf for Wishes', year: 2026) do |t|
  t.edition = '1st Annual'
  t.status = 'open'
  t.registration_open = true
  t.event_date = 'May 2, 2026'
  t.registration_time = '10:00 AM'
  t.start_time = '12:00 PM'
  t.location_name = 'LeoPalace Resort'
  t.location_address = 'Yona, Guam'
  t.max_capacity = 72
  t.entry_fee = 30000  # $300 per team
  t.format_name = 'Scramble'
  t.fee_includes = 'Green Fee, Cart, Lunch, and Prizes'
  t.checks_payable_to = 'Make-A-Wish Guam & CNMI'
  t.contact_name = 'Eric Tydingco'
  t.contact_phone = '671-649-9474'
  t.team_size = 2
end
puts "  Created tournament: #{tournament.display_name}"

puts "\nSeeding complete!"
puts "\nOrganization: #{org.name} (#{org.slug})"
puts "Admin user: #{admin.email} (#{admin.role})"
puts "Tournament: #{tournament.name} - #{tournament.status}"
