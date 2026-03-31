# frozen_string_literal: true

require "test_helper"

class Api::V1::ScoresControllerGolferAuthTest < ActionDispatch::IntegrationTest
  self.use_transactional_tests = true
  fixtures []

  def setup
    @org = Organization.create!(
      name: "Test Org",
      slug: "test-org-scores"
    )
    
    @tournament = Tournament.create!(
      organization: @org,
      name: "Test Tournament",
      year: 2026,
      status: "in_progress",
      total_holes: 18,
      total_par: 72
    )
    
    @group1 = Group.create!(
      tournament: @tournament,
      group_number: 1,
      hole_number: 1
    )
    
    @group2 = Group.create!(
      tournament: @tournament,
      group_number: 2,
      hole_number: 10
    )
    
    @golfer1 = Golfer.create!(
      tournament: @tournament,
      group: @group1,
      name: "Golfer One",
      email: "golfer1@example.com",
      phone: "671-555-1111",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current
    )
    
    @golfer2 = Golfer.create!(
      tournament: @tournament,
      group: @group2,
      name: "Golfer Two",
      email: "golfer2@example.com",
      phone: "671-555-2222",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current
    )

    # Generate JWT for golfer1
    @golfer1_token = GolferAuth.generate_token(@golfer1)
    @golfer2_token = GolferAuth.generate_token(@golfer2)
  end

  def teardown
    Score.delete_all
    RaffleTicket.delete_all
    RafflePrize.delete_all
    Sponsor.delete_all
    Golfer.delete_all
    Group.delete_all
    ActivityLog.delete_all
    Tournament.delete_all
    OrganizationMembership.delete_all
    Organization.delete_all
  end

  # ==========================================
  # Scorecard Access Tests
  # ==========================================

  test "golfer can access their own group's scorecard" do
    get "/api/v1/tournaments/#{@tournament.id}/scores/scorecard", 
        params: { group_id: @group1.id },
        headers: { "Authorization" => "Bearer #{@golfer1_token}" }
    
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal @group1.id, json["group"]["id"]
  end

  test "golfer cannot access another group's scorecard" do
    get "/api/v1/tournaments/#{@tournament.id}/scores/scorecard", 
        params: { group_id: @group2.id },
        headers: { "Authorization" => "Bearer #{@golfer1_token}" }
    
    assert_response :forbidden
    json = JSON.parse(response.body)
    assert_includes json["error"], "own group"
  end

  test "scorecard requires authentication" do
    get "/api/v1/tournaments/#{@tournament.id}/scores/scorecard", 
        params: { group_id: @group1.id }
    
    assert_response :unauthorized
  end

  # ==========================================
  # Batch Score Entry Tests
  # ==========================================

  test "golfer can submit scores for their own group" do
    scores_data = [
      { hole: 1, golfer_id: @golfer1.id, group_id: @group1.id, strokes: 4 },
      { hole: 2, golfer_id: @golfer1.id, group_id: @group1.id, strokes: 5 }
    ]

    post "/api/v1/tournaments/#{@tournament.id}/scores/batch",
         params: { scores: scores_data },
         headers: { 
           "Authorization" => "Bearer #{@golfer1_token}",
           "Content-Type" => "application/json"
         },
         as: :json
    
    assert_response :created
    json = JSON.parse(response.body)
    assert_equal 2, json["scores"].length
  end

  test "golfer cannot submit scores for another group" do
    scores_data = [
      { hole: 1, golfer_id: @golfer2.id, group_id: @group2.id, strokes: 4 }
    ]

    post "/api/v1/tournaments/#{@tournament.id}/scores/batch",
         params: { scores: scores_data },
         headers: { 
           "Authorization" => "Bearer #{@golfer1_token}",
           "Content-Type" => "application/json"
         },
         as: :json
    
    assert_response :forbidden
  end

  test "batch score submission requires authentication" do
    scores_data = [
      { hole: 1, golfer_id: @golfer1.id, group_id: @group1.id, strokes: 4 }
    ]

    post "/api/v1/tournaments/#{@tournament.id}/scores/batch",
         params: { scores: scores_data },
         headers: { "Content-Type" => "application/json" },
         as: :json
    
    assert_response :unauthorized
  end

  # ==========================================
  # Public Endpoint Tests
  # ==========================================

  test "leaderboard is public (no auth required)" do
    get "/api/v1/tournaments/#{@tournament.id}/scores/leaderboard"
    
    assert_response :success
    json = JSON.parse(response.body)
    assert_not_nil json["tournament"]
    assert_not_nil json["leaderboard"]
  end

  test "scores index is public (no auth required)" do
    get "/api/v1/tournaments/#{@tournament.id}/scores"
    
    assert_response :success
    json = JSON.parse(response.body)
    assert_not_nil json["scores"]
  end
end
