require "test_helper"

class GolferTest < ActiveSupport::TestCase
  # ==================
  # Validations
  # ==================
  
  test "should be valid with all required attributes" do
    golfer = Golfer.new(
      tournament: tournaments(:tournament_one),
      name: "Test Golfer",
      email: "test-new@example.com",
      phone: "671-555-1234",
      payment_type: "pay_on_day",
      waiver_accepted_at: Time.current
    )
    assert golfer.valid?, "Golfer should be valid with required attributes: #{golfer.errors.full_messages.join(', ')}"
  end

  test "should require tournament" do
    golfer = Golfer.new(tournament: nil)
    assert_not golfer.valid?
    assert_includes golfer.errors[:tournament], "must exist"
  end

  test "should require name" do
    golfer = Golfer.new(name: nil)
    assert_not golfer.valid?
    assert_includes golfer.errors[:name], "can't be blank"
  end

  test "should require email" do
    golfer = Golfer.new(email: nil)
    assert_not golfer.valid?
    assert_includes golfer.errors[:email], "can't be blank"
  end

  test "should require valid email format" do
    golfer = Golfer.new(email: "invalid-email")
    assert_not golfer.valid?
    assert_includes golfer.errors[:email], "is invalid"
  end

  test "should require unique email within tournament" do
    existing = golfers(:confirmed_paid)
    golfer = Golfer.new(
      tournament: existing.tournament,
      name: "New Golfer",
      email: existing.email,
      phone: "671-555-9999",
      payment_type: "pay_on_day",
      waiver_accepted_at: Time.current
    )
    assert_not golfer.valid?
    assert_includes golfer.errors[:email], "has already registered for this tournament"
  end

  test "should allow same email in different tournaments" do
    existing = golfers(:confirmed_paid)
    other_tournament = tournaments(:tournament_archived)
    
    golfer = Golfer.new(
      tournament: other_tournament,
      name: "Same Person",
      email: existing.email,
      phone: "671-555-9999",
      payment_type: "pay_on_day",
      waiver_accepted_at: Time.current
    )
    assert golfer.valid?, "Same email should be allowed in different tournament: #{golfer.errors.full_messages.join(', ')}"
  end

  test "should require phone" do
    golfer = Golfer.new(phone: nil)
    assert_not golfer.valid?
    assert_includes golfer.errors[:phone], "can't be blank"
  end

  test "should require payment_type" do
    golfer = Golfer.new(payment_type: nil)
    assert_not golfer.valid?
    assert_includes golfer.errors[:payment_type], "can't be blank"
  end

  test "should require valid payment_type" do
    golfer = Golfer.new(payment_type: "invalid")
    assert_not golfer.valid?
    assert_includes golfer.errors[:payment_type], "is not included in the list"
  end

  test "should require waiver_accepted_at" do
    golfer = Golfer.new(waiver_accepted_at: nil)
    assert_not golfer.valid?
    assert_includes golfer.errors[:waiver_accepted_at], "can't be blank"
  end

  # ==================
  # Scopes
  # ==================

  test "confirmed scope returns only confirmed golfers" do
    confirmed = Golfer.confirmed
    assert confirmed.all? { |g| g.registration_status == "confirmed" }
  end

  test "waitlist scope returns only waitlist golfers" do
    waitlist = Golfer.waitlist
    assert waitlist.all? { |g| g.registration_status == "waitlist" }
  end

  test "paid scope returns only paid golfers" do
    paid = Golfer.paid
    assert paid.all? { |g| g.payment_status == "paid" }
  end

  test "unpaid scope returns only unpaid golfers" do
    unpaid = Golfer.unpaid
    assert unpaid.all? { |g| g.payment_status == "unpaid" }
  end

  test "checked_in scope returns only checked in golfers" do
    checked_in = Golfer.checked_in
    assert checked_in.all? { |g| g.checked_in_at.present? }
  end

  test "not_checked_in scope returns only non-checked-in golfers" do
    not_checked_in = Golfer.not_checked_in
    assert not_checked_in.all? { |g| g.checked_in_at.nil? }
  end

  test "assigned scope returns only golfers with groups" do
    assigned = Golfer.assigned
    assert assigned.all? { |g| g.group_id.present? }
  end

  test "unassigned scope returns only golfers without groups" do
    unassigned = Golfer.unassigned
    assert unassigned.all? { |g| g.group_id.nil? }
  end

  test "for_tournament scope returns golfers for specific tournament" do
    tournament = tournaments(:tournament_one)
    golfers = Golfer.for_tournament(tournament.id)
    assert golfers.all? { |g| g.tournament_id == tournament.id }
  end

  # ==================
  # Instance Methods
  # ==================

  test "checked_in? returns true when checked_in_at is set" do
    golfer = golfers(:confirmed_checked_in)
    assert golfer.checked_in?
  end

  test "checked_in? returns false when checked_in_at is nil" do
    golfer = golfers(:confirmed_paid)
    assert_not golfer.checked_in?
  end

  test "check_in! sets checked_in_at when not checked in" do
    golfer = golfers(:confirmed_paid)
    assert_nil golfer.checked_in_at
    
    golfer.check_in!
    golfer.reload
    
    assert_not_nil golfer.checked_in_at
    assert golfer.checked_in?
  end

  test "check_in! clears checked_in_at when already checked in (toggle)" do
    golfer = golfers(:confirmed_checked_in)
    assert_not_nil golfer.checked_in_at
    
    golfer.check_in!
    golfer.reload
    
    assert_nil golfer.checked_in_at
    assert_not golfer.checked_in?
  end

  test "group_position_label returns correct format" do
    golfer = golfers(:confirmed_paid)
    assert_equal "1A", golfer.group_position_label
  end

  test "group_position_label returns nil without group" do
    golfer = golfers(:confirmed_unpaid)
    assert_nil golfer.group_position_label
  end

  # ==================
  # Callbacks
  # ==================

  test "sets default payment_status to unpaid on create" do
    tournament = tournaments(:tournament_one)
    golfer = Golfer.create!(
      tournament: tournament,
      name: "New Golfer",
      email: "new-callback@example.com",
      phone: "671-555-9999",
      payment_type: "pay_on_day",
      waiver_accepted_at: Time.current
    )
    assert_equal "unpaid", golfer.payment_status
  end

  test "sets registration_status to confirmed when tournament not at capacity" do
    tournament = tournaments(:tournament_one)
    # Ensure tournament has capacity
    tournament.update!(max_capacity: 100)
    
    golfer = Golfer.create!(
      tournament: tournament,
      name: "New Golfer",
      email: "capacity-test@example.com",
      phone: "671-555-9999",
      payment_type: "pay_on_day",
      waiver_accepted_at: Time.current
    )
    assert_equal "confirmed", golfer.registration_status
  end

  # ==================
  # Associations
  # ==================

  test "belongs to tournament" do
    golfer = golfers(:confirmed_paid)
    assert_respond_to golfer, :tournament
    assert_instance_of Tournament, golfer.tournament
  end

  test "belongs to group (optional)" do
    golfer = golfers(:confirmed_paid)
    assert_respond_to golfer, :group
    assert_instance_of Group, golfer.group
  end

  test "can exist without a group" do
    golfer = golfers(:confirmed_unpaid)
    assert_nil golfer.group
    assert golfer.valid?
  end

  # ==================
  # Payment Token Methods
  # ==================

  test "generate_payment_token! creates unique token" do
    golfer = golfers(:confirmed_unpaid)
    assert_nil golfer.payment_token
    
    token = golfer.generate_payment_token!
    golfer.reload
    
    assert_not_nil token
    assert_equal token, golfer.payment_token
    assert token.length > 20
  end

  test "generate_payment_token! returns existing token if present" do
    golfer = golfers(:confirmed_unpaid)
    first_token = golfer.generate_payment_token!
    second_token = golfer.generate_payment_token!
    
    assert_equal first_token, second_token
  end

  test "payment_link_url returns full URL with token" do
    golfer = golfers(:confirmed_unpaid)
    golfer.generate_payment_token!
    
    url = golfer.payment_link_url
    assert_not_nil url
    assert_includes url, golfer.payment_token
    assert_includes url, "/pay/"
  end

  test "payment_link_url returns nil without token" do
    golfer = golfers(:confirmed_unpaid)
    assert_nil golfer.payment_token
    assert_nil golfer.payment_link_url
  end

  test "can_send_payment_link? returns true for unpaid golfer" do
    golfer = golfers(:confirmed_unpaid)
    assert golfer.can_send_payment_link?
  end

  test "can_send_payment_link? returns false for paid golfer" do
    golfer = golfers(:confirmed_paid)
    assert_not golfer.can_send_payment_link?
  end

  test "can_send_payment_link? returns false for cancelled golfer" do
    golfer = golfers(:cancelled_golfer)
    assert_not golfer.can_send_payment_link?
  end

  test "can_send_payment_link? returns false for refunded golfer" do
    golfer = golfers(:confirmed_paid)
    golfer.update!(payment_status: "refunded")
    assert_not golfer.can_send_payment_link?
  end
end
