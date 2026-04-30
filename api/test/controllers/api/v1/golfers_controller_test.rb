require "test_helper"

class Api::V1::GolfersControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    # Ensure admin has a clerk_id for auth
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    authenticate_as(@admin)
  end

  # ==================
  # GET /api/v1/golfers
  # ==================

  test "index returns golfers" do
    get api_v1_golfers_url, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    assert json.key?("golfers")
    assert json.key?("meta")
  end

  test "index filters by payment_status" do
    get api_v1_golfers_url, params: { payment_status: "paid" }, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    json["golfers"].each do |golfer|
      assert_equal "paid", golfer["payment_status"]
    end
  end

  test "index filters by registration_status" do
    get api_v1_golfers_url, params: { registration_status: "waitlist" }, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    json["golfers"].each do |golfer|
      assert_equal "waitlist", golfer["registration_status"]
    end
  end

  test "index requires authentication" do
    get api_v1_golfers_url
    assert_response :unauthorized
  end

  # ==================
  # GET /api/v1/golfers/:id
  # ==================

  test "show returns golfer" do
    golfer = golfers(:confirmed_paid)
    get api_v1_golfer_url(golfer), headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    assert_equal golfer.name, json["name"]
  end

  test "show returns 404 for non-existent golfer" do
    get api_v1_golfer_url(id: 999999), headers: auth_headers
    assert_response :not_found
  end

  # ==================
  # POST /api/v1/golfers (public)
  # ==================

  test "create registers new golfer without authentication" do
    unique_email = "new-golfer-#{SecureRandom.hex(4)}@test.com"
    
    # Ensure settings allow registration
    Setting.instance.update!(registration_open: true)
    
    post api_v1_golfers_url, params: {
      golfer: {
        name: "New Golfer",
        email: unique_email,
        phone: "671-555-9999",
        payment_type: "pay_on_day",
        team_category: "Male"
      },
      waiver_accepted: true
    }
    
    assert_response :created, "Expected 201 but got #{response.status}: #{response.body}"
  end

  test "create returns validation errors for invalid data" do
    post api_v1_golfers_url, params: {
      golfer: {
        name: "",
        email: "invalid",
        phone: "",
        payment_type: "invalid"
      }
    }
    assert_response :unprocessable_entity
    
    json = JSON.parse(response.body)
    assert json.key?("errors")
  end

  test "public create ignores spoofed admin registration source" do
    tournament = tournaments(:tournament_one)
    unique_email = "public-spoof-#{SecureRandom.hex(4)}@test.com"

    post api_v1_golfers_url, params: {
      tournament_id: tournament.id,
      golfer: {
        name: "Spoof Attempt",
        email: unique_email,
        phone: "671-555-7777",
        payment_type: "pay_on_day",
        team_category: "Male",
        registration_source: "admin"
      },
      waiver_accepted: true
    }

    assert_response :created, "Expected 201 but got #{response.status}: #{response.body}"

    golfer = Golfer.order(created_at: :desc).find_by!(email: unique_email)
    assert_equal "public", golfer.registration_source
  end

  # ==================
  # PATCH /api/v1/golfers/:id
  # ==================

  test "update modifies golfer" do
    golfer = golfers(:confirmed_unpaid)
    patch api_v1_golfer_url(golfer), params: {
      golfer: { company: "Updated Company" }
    }, headers: auth_headers
    
    assert_response :success
    golfer.reload
    assert_equal "Updated Company", golfer.company
  end

  test "update can assign golfer to group" do
    golfer = golfers(:confirmed_unpaid)
    group = groups(:group_two)
    
    patch api_v1_golfer_url(golfer), params: {
      golfer: { group_id: group.id, position: 3 }
    }, headers: auth_headers
    
    assert_response :success
    golfer.reload
    assert_equal group.id, golfer.group_id
  end

  # ==================
  # DELETE /api/v1/golfers/:id
  # ==================

  test "destroy removes golfer" do
    golfer = golfers(:waitlist_golfer)
    
    assert_difference "Golfer.count", -1 do
      delete api_v1_golfer_url(golfer), headers: auth_headers
    end
    assert_response :no_content
  end

  # ==================
  # POST /api/v1/golfers/:id/check_in
  # ==================

  test "check_in toggles check-in status" do
    golfer = golfers(:confirmed_paid)
    assert_nil golfer.checked_in_at
    
    post check_in_api_v1_golfer_url(golfer), headers: auth_headers
    assert_response :success
    
    golfer.reload
    assert_not_nil golfer.checked_in_at
  end

  test "check_in is idempotent for already checked-in golfer" do
    golfer = golfers(:confirmed_checked_in)
    assert_not_nil golfer.checked_in_at
    checked_in_at = golfer.checked_in_at
    
    post check_in_api_v1_golfer_url(golfer), headers: auth_headers
    assert_response :success
    
    golfer.reload
    assert_not_nil golfer.checked_in_at
    assert_equal checked_in_at.to_i, golfer.checked_in_at.to_i
  end

  test "check_in creates activity log" do
    golfer = golfers(:confirmed_paid)
    
    assert_difference "ActivityLog.count", 1 do
      post check_in_api_v1_golfer_url(golfer), headers: auth_headers
    end
  end

  test "check_in does not create duplicate activity log when already checked in" do
    golfer = golfers(:confirmed_checked_in)

    assert_no_difference "ActivityLog.count" do
      post check_in_api_v1_golfer_url(golfer), headers: auth_headers
    end

    assert_response :success
  end

  test "undo_check_in creates activity log only when it clears check-in" do
    golfer = golfers(:confirmed_checked_in)

    assert_difference "ActivityLog.where(action: 'golfer_unchecked').count", 1 do
      post undo_check_in_api_v1_golfer_url(golfer), headers: auth_headers
    end

    assert_response :success
    assert_nil golfer.reload.checked_in_at

    assert_no_difference "ActivityLog.where(action: 'golfer_unchecked').count" do
      post undo_check_in_api_v1_golfer_url(golfer), headers: auth_headers
    end

    assert_response :unprocessable_entity
  end

  test "refund leaves golfer assigned when Stripe refund fails" do
    tournament = tournaments(:tournament_one)
    group = groups(:group_two)
    golfer = tournament.golfers.create!(
      name: "Legacy Stripe Refund Failure",
      email: "legacy-stripe-refund-failure@example.com",
      phone: "671-555-0177",
      payment_type: "stripe",
      payment_status: "paid",
      stripe_payment_intent_id: "pi_legacy_refund_failure_123",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      group: group,
      position: 2
    )
    Setting.instance.update!(stripe_secret_key: "sk_test_refund_failure")

    refund_singleton = class << Stripe::Refund; self; end
    refund_singleton.send(:alias_method, :__original_create_for_test, :create)
    refund_singleton.send(:define_method, :create) { |*| raise Stripe::StripeError, "boom" }

    begin
      post refund_api_v1_golfer_url(golfer), headers: auth_headers
    ensure
      refund_singleton.send(:alias_method, :create, :__original_create_for_test)
      refund_singleton.send(:remove_method, :__original_create_for_test)
    end

    assert_response :unprocessable_entity
    golfer.reload
    assert_equal "confirmed", golfer.registration_status
    assert_equal group.id, golfer.group_id
    assert_equal 2, golfer.position
    assert_equal "paid", golfer.payment_status
  end

  # ==================
  # POST /api/v1/golfers/:id/payment_details
  # ==================

  test "payment_details records payment" do
    golfer = golfers(:confirmed_unpaid)
    
    post payment_details_api_v1_golfer_url(golfer), params: {
      payment_method: "cash",
      receipt_number: "R999",
      payment_notes: "Paid at registration"
    }, headers: auth_headers
    
    assert_response :success
    golfer.reload
    assert_equal "paid", golfer.payment_status
    assert_equal "cash", golfer.payment_method
    assert_equal "R999", golfer.receipt_number
  end

  # ==================
  # POST /api/v1/golfers/:id/promote
  # ==================

  test "promote moves waitlist golfer to confirmed" do
    golfer = golfers(:waitlist_golfer)
    assert_equal "waitlist", golfer.registration_status
    
    post promote_api_v1_golfer_url(golfer), headers: auth_headers
    assert_response :success
    
    golfer.reload
    assert_equal "confirmed", golfer.registration_status
  end

  test "promote fails for non-waitlist golfer" do
    golfer = golfers(:confirmed_paid)
    
    post promote_api_v1_golfer_url(golfer), headers: auth_headers
    assert_response :unprocessable_entity
  end

  # ==================
  # POST /api/v1/golfers/:id/demote
  # ==================

  test "demote moves confirmed golfer to waitlist" do
    golfer = golfers(:confirmed_unpaid)
    assert_equal "confirmed", golfer.registration_status
    
    post demote_api_v1_golfer_url(golfer), headers: auth_headers
    assert_response :success
    
    golfer.reload
    assert_equal "waitlist", golfer.registration_status
  end

  test "demote fails for waitlist golfer" do
    golfer = golfers(:waitlist_golfer)
    
    post demote_api_v1_golfer_url(golfer), headers: auth_headers
    assert_response :unprocessable_entity
  end

  # ==================
  # POST /api/v1/golfers/:id/update_payment_status
  # ==================

  test "update_payment_status changes to unpaid" do
    golfer = golfers(:confirmed_paid)
    assert_equal "paid", golfer.payment_status
    
    post update_payment_status_api_v1_golfer_url(golfer), params: {
      payment_status: "unpaid"
    }, headers: auth_headers
    
    assert_response :success
    golfer.reload
    assert_equal "unpaid", golfer.payment_status
    assert_nil golfer.payment_method
    assert_nil golfer.receipt_number
  end

  test "update_payment_status changes to paid" do
    golfer = golfers(:confirmed_unpaid)
    
    post update_payment_status_api_v1_golfer_url(golfer), params: {
      payment_status: "paid"
    }, headers: auth_headers
    
    assert_response :success
    golfer.reload
    assert_equal "paid", golfer.payment_status
  end

  test "update_payment_status rejects invalid status" do
    golfer = golfers(:confirmed_paid)
    
    post update_payment_status_api_v1_golfer_url(golfer), params: {
      payment_status: "invalid"
    }, headers: auth_headers
    
    assert_response :unprocessable_entity
  end

  # ==================
  # GET /api/v1/golfers/registration_status (public)
  # ==================

  test "registration_status returns capacity info without auth" do
    get "/api/v1/golfers/registration_status"
    assert_response :success
    
    json = JSON.parse(response.body)
    # Check that key fields are present
    assert json.key?("registration_open"), "Response should have registration_open"
    assert json.key?("confirmed_count"), "Response should have confirmed_count"
    assert json.key?("max_capacity"), "Response should have max_capacity"
    assert json.key?("capacity_remaining"), "Response should have capacity_remaining"
  end

  # ==================
  # GET /api/v1/golfers/stats
  # ==================

  test "stats returns golfer statistics" do
    get stats_api_v1_golfers_url, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    assert json.key?("total")
    assert json.key?("confirmed")
    assert json.key?("waitlist")
    assert json.key?("paid")
    assert json.key?("checked_in")
  end

  # ==================
  # POST /api/v1/golfers/:id/send_payment_link
  # ==================

  test "send_payment_link generates token and sends email" do
    golfer = golfers(:confirmed_unpaid)
    assert_nil golfer.payment_token
    
    post send_payment_link_api_v1_golfer_url(golfer), headers: auth_headers
    assert_response :success
    
    golfer.reload
    assert_not_nil golfer.payment_token
    
    json = JSON.parse(response.body)
    assert json.key?("message")
    assert json.key?("payment_link")
  end

  test "send_payment_link fails for paid golfer" do
    golfer = golfers(:confirmed_paid)
    
    post send_payment_link_api_v1_golfer_url(golfer), headers: auth_headers
    assert_response :unprocessable_entity
  end

  test "send_payment_link creates activity log" do
    golfer = golfers(:confirmed_unpaid)
    
    assert_difference "ActivityLog.count", 1 do
      post send_payment_link_api_v1_golfer_url(golfer), headers: auth_headers
    end
    
    log = ActivityLog.last
    assert_equal "payment_link_sent", log.action
  end

  # ==================
  # Payment Details - verify payment_amount_cents
  # ==================

  test "payment_details sets payment_amount_cents" do
    golfer = golfers(:confirmed_unpaid)
    tournament = golfer.tournament
    
    post payment_details_api_v1_golfer_url(golfer), params: {
      payment_method: "cash"
    }, headers: auth_headers
    
    assert_response :success
    golfer.reload
    assert_equal tournament.entry_fee, golfer.payment_amount_cents
  end

  test "payment_details preserves entry fee regardless of golfer type flags" do
    golfer = golfers(:confirmed_unpaid)
    tournament = golfer.tournament

    post payment_details_api_v1_golfer_url(golfer), params: {
      payment_method: "cash"
    }, headers: auth_headers

    assert_response :success
    golfer.reload
    assert_equal tournament.entry_fee, golfer.payment_amount_cents
  end
end
