require "test_helper"
require "tempfile"

class Api::V1::RaffleControllerTest < ActionDispatch::IntegrationTest
  setup do
    @tempfiles = []
    @tournament = tournaments(:tournament_one)
    @admin = users(:user_one)
    @admin.update!(clerk_id: "test_clerk_raffle_#{@admin.id}") if @admin.clerk_id.blank?
    OrganizationMembership.find_or_create_by!(user: @admin, organization: @tournament.organization) do |membership|
      membership.role = "admin"
    end
    @headers = { "Authorization" => "Bearer test_token_#{@admin.id}" }
  end

  teardown do
    @tempfiles.each(&:close!)
  end

  test "admin can create a raffle prize with an uploaded image" do
    file = build_png_upload

    assert_difference "RafflePrize.count", 1 do
      assert_difference "ActiveStorage::Attachment.count", 1 do
        assert_difference -> { ActivityLog.where(action: "raffle_prize_created").count }, 1 do
          post "/api/v1/tournaments/#{@tournament.id}/raffle/prizes",
               params: {
                 prize: {
                   name: "Golf Bag",
                   tier: "standard",
                   value_cents: 30000,
                   image: file
                 }
               },
               headers: @headers
        end
      end
    end

    assert_response :created
    json = JSON.parse(response.body)
    assert_match %r{\Ahttp://www.example.com/rails/active_storage/blobs/}, json.dig("prize", "image_url")

    prize = RafflePrize.find(json.dig("prize", "id"))
    assert prize.image.attached?
    assert_match %r{\Ahttp://www.example.com/rails/active_storage/blobs/}, prize.image_url

    log = ActivityLog.where(action: "raffle_prize_created").last
    assert_equal prize.id, log.target_id
    assert_equal true, log.metadata.fetch("image_attached")
  end

  test "public board returns attachment url even if stored image_url is stale" do
    prize = @tournament.raffle_prizes.create!(
      name: "Golf Bag",
      tier: "standard",
      value_cents: 30000,
      image_url: "https://old.example.com/broken.jpg"
    )
    image_file = build_png_file
    prize.image.attach(
      io: image_file,
      filename: "test.png",
      content_type: "image/png"
    )

    get "/api/v1/tournaments/#{@tournament.id}/raffle/board"

    assert_response :success
    json = JSON.parse(response.body)
    returned = json.fetch("prizes").find { |p| p["id"] == prize.id }
    assert_match %r{\Ahttp://www.example.com/rails/active_storage/blobs/}, returned["image_url"]
    assert_not_equal "https://old.example.com/broken.jpg", returned["image_url"]
  ensure
    image_file&.close
  end

  test "public board preloads prize image attachments" do
    6.times do |idx|
      prize = @tournament.raffle_prizes.create!(
        name: "Attached Prize #{idx}",
        tier: "standard",
        value_cents: 30000,
        position: idx
      )
      image_file = build_png_file
      prize.image.attach(
        io: image_file,
        filename: "test-#{idx}.png",
        content_type: "image/png"
      )
    end

    select_count = 0
    callback = lambda do |_name, _started, _finished, _unique_id, payload|
      sql = payload[:sql]
      next if payload[:name] == "SCHEMA"
      next unless sql&.match?(/\ASELECT/i)

      select_count += 1 if sql.include?("active_storage_attachments") || sql.include?("active_storage_blobs")
    end

    ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
      get "/api/v1/tournaments/#{@tournament.id}/raffle/board"
    end

    assert_response :success
    assert_operator select_count, :<=, 3
  end

  test "invalid uploaded prize image type is rejected without creating prize" do
    tempfile = Tempfile.new([ "prize", ".txt" ])
    tempfile.write("not an image")
    tempfile.rewind
    file = Rack::Test::UploadedFile.new(
      tempfile.path,
      "text/plain",
      original_filename: "prize.txt"
    )

    assert_no_difference "RafflePrize.count" do
      post "/api/v1/tournaments/#{@tournament.id}/raffle/prizes",
           params: {
             prize: {
               name: "Bad Upload",
               tier: "standard",
               value_cents: 1000,
               image: file
             }
           },
           headers: @headers
    end

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body).fetch("error"), "Image must be a valid JPEG"
  ensure
    tempfile&.close!
  end

  test "spoofed image content type is rejected without creating prize" do
    tempfile = Tempfile.new([ "spoofed-prize", ".jpg" ])
    tempfile.write("not actually a jpeg")
    tempfile.rewind
    file = Rack::Test::UploadedFile.new(
      tempfile.path,
      "image/jpeg",
      original_filename: "prize.jpg"
    )

    assert_no_difference "RafflePrize.count" do
      post "/api/v1/tournaments/#{@tournament.id}/raffle/prizes",
           params: {
             prize: {
               name: "Spoofed Upload",
               tier: "standard",
               value_cents: 1000,
               image: file
             }
           },
           headers: @headers
    end

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body).fetch("error"), "Image must be a valid JPEG"
  ensure
    tempfile&.close!
  end

  test "oversized prize image is rejected before image processing" do
    tempfile = Tempfile.new([ "oversized-prize", ".jpg" ])
    tempfile.binmode
    tempfile.write("x" * (5.megabytes + 1))
    tempfile.rewind
    file = Rack::Test::UploadedFile.new(
      tempfile.path,
      "image/jpeg",
      original_filename: "prize.jpg"
    )

    assert_no_difference "RafflePrize.count" do
      post "/api/v1/tournaments/#{@tournament.id}/raffle/prizes",
           params: {
             prize: {
               name: "Oversized Upload",
               tier: "standard",
               value_cents: 1000,
               image: file
             }
           },
           headers: @headers
    end

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body).fetch("error"), "Image must be smaller than 5MB"
  ensure
    tempfile&.close!
  end

  test "imagemagick avif container aliases are accepted" do
    assert_equal "image/avif", ImageUploadValidation::MAGICK_IMAGE_TYPES.fetch("HEIF")
    assert_equal "image/avif", ImageUploadValidation::MAGICK_IMAGE_TYPES.fetch("HEIC")
  end

  test "admin can remove an uploaded prize image" do
    prize = @tournament.raffle_prizes.create!(
      name: "Golf Bag",
      tier: "standard",
      value_cents: 30000
    )
    image_file = build_png_file
    prize.image.attach(
      io: image_file,
      filename: "test.png",
      content_type: "image/png"
    )
    prize.update!(image_url: "http://www.example.com/rails/active_storage/blobs/stale/test.svg")

    assert_difference "ActiveStorage::Attachment.count", -1 do
      assert_difference -> { ActivityLog.where(action: "raffle_prize_updated").count }, 1 do
        patch "/api/v1/tournaments/#{@tournament.id}/raffle/prizes/#{prize.id}",
              params: {
                prize: {
                  name: prize.name,
                  tier: prize.tier,
                  value_cents: prize.value_cents,
                  remove_image: true
                }
              },
              headers: @headers
      end
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_nil json.dig("prize", "image_url")

    prize.reload
    assert_not prize.image.attached?
    assert_nil prize.image_url
    log = ActivityLog.where(action: "raffle_prize_updated").last
    assert_includes log.metadata.fetch("changed_fields"), "image"
    assert_equal "removed", log.metadata.fetch("image_action")
  ensure
    image_file&.close
  end

  test "admin prize edits and deletes are recorded in activity log" do
    prize = @tournament.raffle_prizes.create!(
      name: "Original Prize",
      tier: "standard",
      value_cents: 10000
    )

    assert_difference -> { ActivityLog.where(action: "raffle_prize_updated").count }, 1 do
      patch "/api/v1/tournaments/#{@tournament.id}/raffle/prizes/#{prize.id}",
            params: {
              prize: {
                name: "Updated Prize",
                tier: "gold",
                value_cents: 15000
              }
            },
            headers: @headers
    end

    assert_response :success
    update_log = ActivityLog.where(action: "raffle_prize_updated").last
    assert_equal prize.id, update_log.target_id
    assert_includes update_log.metadata.fetch("changed_fields"), "name"
    assert_includes update_log.metadata.fetch("changed_fields"), "tier"
    assert_includes update_log.details, "Updated raffle prize Updated Prize"

    assert_difference "RafflePrize.count", -1 do
      assert_difference -> { ActivityLog.where(action: "raffle_prize_deleted").count }, 1 do
        delete "/api/v1/tournaments/#{@tournament.id}/raffle/prizes/#{prize.id}",
               headers: @headers
      end
    end

    assert_response :success
    delete_log = ActivityLog.where(action: "raffle_prize_deleted").last
    assert_equal prize.id, delete_log.target_id
    assert_equal "Updated Prize", delete_log.metadata.fetch("name")
  end

  test "direct ticket admin actions are recorded in activity log" do
    ticket = @tournament.raffle_tickets.create!(
      purchaser_name: "Walk-up Buyer",
      purchaser_email: "buyer@example.com",
      price_cents: 2000,
      payment_status: "pending"
    )

    assert_difference -> { ActivityLog.where(action: "raffle_ticket_marked_paid").count }, 1 do
      post "/api/v1/tournaments/#{@tournament.id}/raffle/tickets/#{ticket.id}/mark_paid",
           headers: @headers
    end

    assert_response :success
    paid_log = ActivityLog.where(action: "raffle_ticket_marked_paid").last
    assert_equal ticket.id, paid_log.target_id
    assert_equal "pending", paid_log.metadata.fetch("previous_status")

    assert_difference "RaffleTicket.count", -1 do
      assert_difference -> { ActivityLog.where(action: "raffle_ticket_deleted").count }, 1 do
        delete "/api/v1/tournaments/#{@tournament.id}/raffle/tickets/#{ticket.id}",
               headers: @headers
      end
    end

    assert_response :success
    delete_log = ActivityLog.where(action: "raffle_ticket_deleted").last
    assert_equal ticket.id, delete_log.target_id
    assert_equal "paid", delete_log.metadata.fetch("payment_status")
  end

  test "raffle settings changes are recorded in raffle activity log" do
    assert_difference -> { ActivityLog.where(action: "raffle_settings_updated").count }, 1 do
      patch "/api/v1/tournaments/#{@tournament.id}",
            params: { tournament: { raffle_enabled: !@tournament.raffle_enabled } },
            headers: @headers
    end

    assert_response :success
    log = ActivityLog.where(action: "raffle_settings_updated").last
    assert_equal @tournament.id, log.tournament_id
    assert_includes log.metadata.fetch("changed_fields"), "raffle_enabled"
  end

  test "sync tickets includes unpaid active registrations and voids ineligible complimentary tickets" do
    @tournament.update!(
      raffle_enabled: true,
      config: (@tournament.config || {}).merge("raffle_include_with_registration" => true)
    )
    unpaid = golfers(:confirmed_unpaid)
    cancelled = golfers(:cancelled_golfer)
    waitlisted = golfers(:waitlist_golfer)
    cancelled_ticket = @tournament.raffle_tickets.create!(
      golfer: cancelled,
      purchaser_name: cancelled.name,
      purchaser_email: cancelled.email,
      purchaser_phone: cancelled.phone,
      price_cents: 0,
      payment_status: "paid",
      purchased_at: Time.current
    )
    waitlisted_ticket = @tournament.raffle_tickets.create!(
      golfer: waitlisted,
      purchaser_name: waitlisted.name,
      purchaser_email: waitlisted.email,
      purchaser_phone: waitlisted.phone,
      price_cents: 0,
      payment_status: "paid",
      purchased_at: Time.current
    )

    assert_difference -> { @tournament.raffle_tickets.where(golfer: unpaid).count }, 1 do
      assert_no_difference -> { @tournament.raffle_tickets.where(golfer: cancelled).count } do
        assert_no_difference -> { @tournament.raffle_tickets.where(golfer: waitlisted).count } do
          post "/api/v1/tournaments/#{@tournament.id}/raffle/sync_tickets",
               headers: @headers
        end
      end
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_operator json.fetch("total_teams"), :>=, 1
    assert_equal 2, json.fetch("voided")
    assert_equal "voided", cancelled_ticket.reload.payment_status
    assert_equal "voided", waitlisted_ticket.reload.payment_status
  end

  test "public ticket lookup excludes tickets linked to waitlisted golfers" do
    waitlisted = golfers(:waitlist_golfer)
    @tournament.raffle_tickets.create!(
      golfer: waitlisted,
      purchaser_name: waitlisted.name,
      purchaser_email: waitlisted.email,
      purchaser_phone: waitlisted.phone,
      price_cents: 0,
      payment_status: "paid",
      purchased_at: Time.current
    )

    get "/api/v1/tournaments/#{@tournament.id}/raffle/tickets",
        params: { query: waitlisted.email }

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 0, json.fetch("ticket_count")
    assert_empty json.fetch("tickets")
  end

  private

  def build_png_upload
    file = build_png_file
    Rack::Test::UploadedFile.new(file.path, "image/png", original_filename: "prize.png")
  end

  def build_png_file
    file = Tempfile.new([ "prize", ".png" ])
    file.binmode
    system("magick", "-size", "16x16", "xc:#0057B8", file.path, exception: true)
    file.rewind
    @tempfiles << file
    file
  end
end
