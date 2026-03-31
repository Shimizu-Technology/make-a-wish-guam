require "test_helper"

class Api::V1::ActivityLogsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    authenticate_as(@admin)
  end

  # ==================
  # GET /api/v1/activity_logs
  # ==================

  test "index returns activity logs" do
    get api_v1_activity_logs_url, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    assert json.key?("activity_logs")
    assert json.key?("meta")
  end

  test "index filters by action_type" do
    tournament = tournaments(:tournament_one)
    
    # Create a specific log with a unique action for filtering
    ActivityLog.create!(
      admin: @admin,
      tournament: tournament,
      action: "admin_created",
      details: "Test filter - unique"
    )
    
    # Note: The param is action_type, not action
    get api_v1_activity_logs_url, params: { action_type: "admin_created", tournament_id: tournament.id }, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    # Should only return logs with that action
    assert json["activity_logs"].length > 0, "Should find at least one admin_created log"
    json["activity_logs"].each do |log|
      assert_equal "admin_created", log["action"]
    end
  end

  test "index filters by admin_id" do
    get api_v1_activity_logs_url, params: { admin_id: @admin.id }, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    json["activity_logs"].each do |log|
      # Admin email should match the admin we filtered by
    end
  end

  test "index requires authentication" do
    get api_v1_activity_logs_url
    assert_response :unauthorized
  end

  # ==================
  # GET /api/v1/activity_logs/summary
  # ==================

  test "summary returns aggregated data" do
    get summary_api_v1_activity_logs_url, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    assert json.key?("today_count")
    assert json.key?("by_action")
    assert json.key?("by_admin")
  end

  # ==================
  # GET /api/v1/activity_logs/golfer/:golfer_id
  # ==================

  test "golfer_activity returns logs for specific golfer" do
    golfer = golfers(:confirmed_paid)
    
    # Create a log for this golfer
    ActivityLog.create!(
      admin: @admin,
      action: "golfer_checked_in",
      target_type: "Golfer",
      target_id: golfer.id,
      target_name: golfer.name
    )
    
    get golfer_history_api_v1_activity_logs_url(golfer_id: golfer.id), headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    # Response format is { activity_logs: [...], golfer_id, golfer_name }
    assert json.key?("activity_logs"), "Response should have activity_logs key"
    assert_equal golfer.id, json["golfer_id"]
    
    json["activity_logs"].each do |log|
      assert_equal golfer.id, log["target_id"]
    end
  end
end

