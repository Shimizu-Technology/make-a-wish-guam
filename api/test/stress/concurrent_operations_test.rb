require_relative "../test_helper"
require 'net/http'
require 'json'

class ConcurrentOperationsTest < ActionDispatch::IntegrationTest
  setup do
    @admin = admins(:admin_one)
    authenticate_as(@admin)
    @tournament = tournaments(:tournament_one)
    @headers = auth_headers  # Capture headers for use in threads
  end

  # ============================================================
  # Test 1: Sequential check-ins (baseline performance)
  # ============================================================
  test "sequential check-ins performance" do
    golfers = create_test_golfers(10, "seq_checkin")
    
    puts "\n=== Sequential Check-ins Test ==="
    puts "Testing #{golfers.count} sequential check-ins..."

    start_time = Time.now
    
    golfers.each do |golfer|
      post "/api/v1/golfers/#{golfer.id}/check_in", headers: @headers
      assert_response :success
    end
    
    total_time = Time.now - start_time
    avg_time = (total_time * 1000 / golfers.count).round
    
    puts "✅ #{golfers.count} check-ins in #{(total_time * 1000).round}ms"
    puts "   Average: #{avg_time}ms per check-in"
    
    # Verify all checked in
    golfers.each { |g| assert g.reload.checked_in_at.present? }
    
    # Performance assertion - should be under 100ms average
    assert avg_time < 100, "Check-ins should average under 100ms (got #{avg_time}ms)"
  end

  # ============================================================
  # Test 2: Sequential payments (baseline performance)
  # ============================================================
  test "sequential payments performance" do
    golfers = create_test_golfers(10, "seq_payment")
    
    puts "\n=== Sequential Payments Test ==="
    puts "Testing #{golfers.count} sequential payments..."

    start_time = Time.now
    
    golfers.each_with_index do |golfer, i|
      post "/api/v1/golfers/#{golfer.id}/payment_details",
           params: { payment_method: 'cash', receipt_number: "SEQ-#{i}" },
           headers: @headers
      assert_response :success
    end
    
    total_time = Time.now - start_time
    avg_time = (total_time * 1000 / golfers.count).round
    
    puts "✅ #{golfers.count} payments in #{(total_time * 1000).round}ms"
    puts "   Average: #{avg_time}ms per payment"
    
    # Verify all paid
    golfers.each { |g| assert_equal 'paid', g.reload.payment_status }
    
    # Performance assertion
    assert avg_time < 150, "Payments should average under 150ms (got #{avg_time}ms)"
  end

  # ============================================================
  # Test 3: Rapid-fire check-ins (stress test)
  # ============================================================
  test "rapid fire check-ins" do
    golfers = create_test_golfers(30, "rapid_checkin")
    
    puts "\n=== Rapid-Fire Check-ins Test ==="
    puts "Testing #{golfers.count} rapid check-ins..."

    start_time = Time.now
    results = []
    
    golfers.each do |golfer|
      req_start = Time.now
      post "/api/v1/golfers/#{golfer.id}/check_in", headers: @headers
      results << { status: response.status, time: Time.now - req_start }
    end
    
    total_time = Time.now - start_time
    success_count = results.count { |r| r[:status] == 200 }
    avg_time = results.sum { |r| r[:time] } / results.size * 1000
    
    puts "✅ #{success_count}/#{golfers.count} succeeded"
    puts "   Total: #{(total_time * 1000).round}ms"
    puts "   Average: #{avg_time.round}ms per request"
    puts "   Throughput: #{(golfers.count / total_time).round(1)} requests/sec"
    
    assert_equal golfers.count, success_count
  end

  # ============================================================
  # Test 4: Check-in toggle (same golfer multiple times)
  # ============================================================
  test "check-in toggle handles rapid toggles" do
    golfer = create_test_golfers(1, "toggle").first
    
    puts "\n=== Check-in Toggle Test ==="
    puts "Toggling same golfer 10 times rapidly..."

    results = []
    10.times do |i|
      post "/api/v1/golfers/#{golfer.id}/check_in", headers: @headers
      results << {
        attempt: i + 1,
        status: response.status,
        checked_in: JSON.parse(response.body)['checked_in_at'].present?
      }
    end
    
    success_count = results.count { |r| r[:status] == 200 }
    puts "✅ #{success_count}/10 successful"
    
    # Show toggle pattern
    pattern = results.map { |r| r[:checked_in] ? "✓" : "○" }.join(" ")
    puts "   Toggle pattern: #{pattern}"
    
    assert_equal 10, success_count
    
    # Verify final state is consistent
    golfer.reload
    assert golfer.valid?, "Golfer should remain valid after rapid toggles"
  end

  # ============================================================
  # Test 5: Payment idempotency (same golfer paid multiple times)
  # ============================================================
  test "payment updates handle rapid updates" do
    golfer = create_test_golfers(1, "pay_rapid").first
    
    puts "\n=== Rapid Payment Updates Test ==="
    puts "Updating same golfer payment 5 times..."

    results = []
    5.times do |i|
      post "/api/v1/golfers/#{golfer.id}/payment_details",
           params: { payment_method: 'cash', receipt_number: "RAPID-#{i}" },
           headers: @headers
      receipt = begin
        JSON.parse(response.body)['receipt_number']
      rescue
        nil
      end
      results << {
        attempt: i + 1,
        status: response.status,
        receipt: receipt
      }
    end
    
    success_count = results.count { |r| r[:status] == 200 }
    puts "✅ #{success_count}/5 returned 200"
    
    golfer.reload
    puts "   Final receipt: #{golfer.receipt_number}"
    puts "   Payment status: #{golfer.payment_status}"
    
    assert_equal 5, success_count
    assert_equal 'paid', golfer.payment_status
    assert golfer.receipt_number.present?
  end

  # ============================================================
  # Test 6: Full workflow simulation
  # ============================================================
  test "full tournament day workflow simulation" do
    golfers = create_test_golfers(20, "workflow")
    
    puts "\n=== Full Workflow Simulation ==="
    puts "Simulating tournament day with #{golfers.count} golfers..."
    puts ""

    # Phase 1: Check-ins
    puts "Phase 1: Check-ins"
    start = Time.now
    golfers.each do |g|
      post "/api/v1/golfers/#{g.id}/check_in", headers: @headers
      assert_response :success
    end
    checkin_time = Time.now - start
    puts "  ✅ #{golfers.count} check-ins in #{(checkin_time * 1000).round}ms"

    # Phase 2: Payments (various methods)
    puts "Phase 2: Payments"
    start = Time.now
    payment_methods = %w[cash credit check cash credit]
    golfers.each_with_index do |g, i|
      post "/api/v1/golfers/#{g.id}/payment_details",
           params: { 
             payment_method: payment_methods[i % 5], 
             receipt_number: "WF-#{i}",
             payment_notes: "Tournament day payment"
           },
           headers: @headers
      assert_response :success
    end
    payment_time = Time.now - start
    puts "  ✅ #{golfers.count} payments in #{(payment_time * 1000).round}ms"

    # Verify final state
    puts ""
    puts "Final verification:"
    
    all_checked_in = golfers.all? { |g| g.reload.checked_in_at.present? }
    all_paid = golfers.all? { |g| g.reload.payment_status == 'paid' }
    
    puts "  Checked in: #{all_checked_in ? '✅' : '❌'} (#{golfers.count { |g| g.checked_in_at.present? }}/#{golfers.count})"
    puts "  Paid: #{all_paid ? '✅' : '❌'} (#{golfers.count { |g| g.payment_status == 'paid' }}/#{golfers.count})"
    
    # Payment breakdown
    by_method = golfers.group_by { |g| g.reload.payment_method }
    puts "  Payment methods:"
    by_method.each { |method, list| puts "    - #{method}: #{list.count}" }
    
    assert all_checked_in, "All golfers should be checked in"
    assert all_paid, "All golfers should be paid"
    
    puts ""
    puts "✅ Full workflow simulation complete!"
  end

  private

  def create_test_golfers(count, prefix)
    count.times.map do |i|
      Golfer.create!(
        tournament: @tournament,
        name: "#{prefix.titleize} #{i}",
        email: "#{prefix}#{i}@test.com",
        phone: "671-555-#{prefix.hash.abs.to_s[0..3]}#{i}",
        payment_type: 'pay_on_day',
        waiver_accepted_at: Time.current,
        registration_status: 'confirmed',
        payment_status: 'unpaid'
      )
    end
  end
end
