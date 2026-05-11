require "test_helper"

class Api::V1::PaymentReportsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    authenticate_as(@admin)
    @organization = organizations(:org_one)
    @tournament = @organization.tournaments.create!(
      name: "Payment Report Tournament",
      slug: "payment-report-tournament",
      year: 2026,
      status: "open",
      event_date: "May 2, 2026",
      registration_open: true,
      entry_fee: 30_000,
      max_capacity: 100
    )
  end

  test "show separates registration, sponsor, and raffle payments" do
    sponsor = @tournament.sponsors.create!(
      name: "Wish Sponsor",
      tier: "gold",
      slot_count: 2,
      position: 1
    )
    sponsor_golfer = @tournament.golfers.create!(
      name: "Sponsored Team",
      email: "sponsored@example.com",
      phone: "671-555-2222",
      payment_type: "sponsor",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Co-Ed",
      sponsor: sponsor,
      sponsor_name: sponsor.name
    )
    paid_golfer = @tournament.golfers.create!(
      name: "Paid Team",
      email: "paid-team@example.com",
      phone: "671-555-1111",
      partner_name: "Paid Partner",
      payment_type: "swipe_simple",
      payment_status: "paid",
      payment_method: "swipe_simple_confirmed",
      payment_amount_cents: 30_000,
      paid_at: Time.zone.parse("2026-05-01 10:00"),
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Co-Ed"
    )

    paid_ticket = @tournament.raffle_tickets.create!(
      purchaser_name: "Raffle Buyer",
      purchaser_email: "buyer@example.com",
      purchaser_phone: "671-555-3333",
      price_cents: 2_000,
      payment_status: "paid",
      payment_method: "swipe_simple",
      purchased_at: Time.zone.parse("2026-05-02 12:00"),
      sold_by_user: @admin
    )
    @tournament.raffle_tickets.create!(
      golfer: paid_golfer,
      purchaser_name: paid_golfer.name,
      purchaser_email: paid_golfer.email,
      purchaser_phone: paid_golfer.phone,
      price_cents: 0,
      payment_status: "paid",
      purchased_at: Time.zone.parse("2026-05-02 10:00")
    )
    @tournament.raffle_tickets.create!(
      purchaser_name: "Pending Buyer",
      purchaser_email: "pending-raffle@example.com",
      price_cents: 1_000,
      payment_status: "pending"
    )
    @tournament.raffle_tickets.create!(
      purchaser_name: "Voided Buyer",
      purchaser_email: "voided@example.com",
      price_cents: 1_000,
      payment_status: "voided",
      voided_at: Time.current
    )

    get "/api/v1/tournaments/#{@tournament.id}/payment_report", headers: auth_headers

    assert_response :success
    json = JSON.parse(response.body)

    assert_equal 30_000, json.dig("summary", "registration_revenue_cents")
    assert_equal 2_000, json.dig("summary", "raffle_revenue_cents")
    assert_equal 32_000, json.dig("summary", "total_revenue_cents")
    assert_equal 1, json.dig("summary", "sponsored_registration_count")
    assert_equal 1, json.dig("summary", "raffle_purchased_ticket_count")
    assert_equal 1, json.dig("summary", "raffle_complimentary_ticket_count")
    assert_equal 1, json.dig("summary", "raffle_pending_ticket_count")
    assert_equal 1, json.dig("summary", "raffle_voided_ticket_count")

    registration_row = json.fetch("registration_payments").find { |row| row["id"] == paid_golfer.id }
    assert_equal "registration", registration_row.fetch("type")
    assert_equal 30_000, registration_row.fetch("amount_cents")
    assert_equal "SwipeSimple", registration_row.fetch("payment_method_label")

    sponsor_row = json.fetch("sponsored_registrations").find { |row| row["id"] == sponsor_golfer.id }
    assert_equal "Wish Sponsor", sponsor_row.fetch("sponsor_name")
    assert_equal true, sponsor_row.fetch("operationally_cleared")

    raffle_row = json.fetch("raffle_sales").find { |row| row["id"] == paid_ticket.id }
    assert_equal "raffle", raffle_row.fetch("type")
    assert_equal "SwipeSimple", raffle_row.fetch("payment_method_label")
    assert_equal 2_000, raffle_row.fetch("amount_cents")

    ledger_types = json.fetch("combined_ledger").map { |row| row.fetch("type") }
    assert_includes ledger_types, "registration"
    assert_includes ledger_types, "raffle"
  end

  test "show requires tournament access" do
    get "/api/v1/tournaments/#{@tournament.id}/payment_report"

    assert_response :unauthorized
  end
end
