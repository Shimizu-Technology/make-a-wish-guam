require "test_helper"

class ActivityLogTest < ActiveSupport::TestCase
  # ==================
  # Validations
  # ==================

  test "should be valid with required attributes" do
    log = ActivityLog.new(
      admin: admins(:admin_one),
      action: "golfer_checked_in"
    )
    assert log.valid?
  end

  test "should require action" do
    log = ActivityLog.new(action: nil)
    assert_not log.valid?
    assert_includes log.errors[:action], "can't be blank"
  end

  test "should require valid action type" do
    log = ActivityLog.new(
      admin: admins(:admin_one),
      action: "invalid_action"
    )
    assert_not log.valid?
    assert_includes log.errors[:action], "is not included in the list"
  end

  test "admin is optional" do
    log = ActivityLog.new(
      admin: nil,
      action: "golfer_checked_in"
    )
    assert log.valid?
  end

  # ==================
  # Class Methods
  # ==================

  test "log creates a new activity log" do
    admin = admins(:admin_one)
    golfer = golfers(:confirmed_paid)

    assert_difference "ActivityLog.count", 1 do
      ActivityLog.log(
        admin: admin,
        action: "golfer_checked_in",
        target: golfer,
        details: "Checked in #{golfer.name}"
      )
    end
  end

  test "log sets target attributes correctly" do
    admin = admins(:admin_one)
    golfer = golfers(:confirmed_paid)

    log = ActivityLog.log(
      admin: admin,
      action: "golfer_checked_in",
      target: golfer,
      details: "Checked in #{golfer.name}"
    )

    assert_equal "Golfer", log.target_type
    assert_equal golfer.id, log.target_id
    assert_equal golfer.name, log.target_name
  end

  test "log stores admin info in metadata" do
    admin = admins(:admin_one)
    golfer = golfers(:confirmed_paid)

    log = ActivityLog.log(
      admin: admin,
      action: "golfer_checked_in",
      target: golfer,
      details: "Test"
    )

    assert_equal admin.email, log.metadata["admin_email"]
  end

  # ==================
  # Instance Methods
  # ==================

  test "admin_display_name returns admin name when present" do
    log = activity_logs(:check_in_log)
    log.admin.update!(name: "Test Name")
    assert_equal "Test Name", log.admin_display_name
  end

  test "admin_display_name returns admin email when name is blank" do
    log = activity_logs(:check_in_log)
    log.admin.update!(name: nil)
    assert_equal log.admin.email, log.admin_display_name
  end

  test "admin_display_name returns System when no admin" do
    log = ActivityLog.new(action: "golfer_checked_in", admin: nil)
    assert_equal "System", log.admin_display_name
  end

  # ==================
  # Scopes
  # ==================

  test "recent scope orders by created_at desc" do
    logs = ActivityLog.recent
    dates = logs.pluck(:created_at)
    assert_equal dates.sort.reverse, dates
  end

  test "by_admin scope filters by admin_id" do
    admin = admins(:admin_one)
    logs = ActivityLog.by_admin(admin.id)
    assert logs.all? { |l| l.admin_id == admin.id }
  end

  test "by_action scope filters by action" do
    logs = ActivityLog.by_action("golfer_checked_in")
    assert logs.all? { |l| l.action == "golfer_checked_in" }
  end

  test "today scope returns only today's logs" do
    # Create a log for today
    ActivityLog.create!(
      admin: admins(:admin_one),
      action: "golfer_checked_in",
      created_at: Time.current
    )
    
    today_logs = ActivityLog.today
    assert today_logs.all? { |l| l.created_at.to_date == Date.current }
  end

  # ==================
  # Valid Actions
  # ==================

  test "ACTIONS constant includes all expected actions" do
    expected_actions = %w[
      golfer_created golfer_updated golfer_deleted
      golfer_checked_in golfer_unchecked
      payment_marked payment_updated
      group_created group_updated group_deleted
      golfer_assigned_to_group golfer_removed_from_group
      settings_updated admin_created admin_deleted
      payment_link_sent payment_completed employee_status_changed
    ]
    
    expected_actions.each do |action|
      assert_includes ActivityLog::ACTIONS, action, "Missing action: #{action}"
    end
  end

  test "payment_completed is a valid action" do
    log = ActivityLog.new(
      admin: admins(:admin_one),
      action: "payment_completed"
    )
    assert log.valid?
  end

  test "payment_link_sent is a valid action" do
    log = ActivityLog.new(
      admin: admins(:admin_one),
      action: "payment_link_sent"
    )
    assert log.valid?
  end

  test "employee_status_changed is a valid action" do
    log = ActivityLog.new(
      admin: admins(:admin_one),
      action: "employee_status_changed"
    )
    assert log.valid?
  end
end
