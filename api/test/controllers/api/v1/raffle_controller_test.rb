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

  test "sell tickets returns notification delivery failures without losing the sale" do
    sms_calls = []
    sms_stub = lambda do |tickets:, buyer_phone:, buyer_name:, tournament:|
      sms_calls << {
        count: tickets.size,
        buyer_phone: buyer_phone,
        buyer_name: buyer_name,
        tournament: tournament
      }
      { success: false, error: "Carrier rejected message" }
    end

    assert_difference -> { @tournament.raffle_tickets.count }, 4 do
      assert_difference -> { @tournament.raffle_sale_batches.count }, 1 do
      with_singleton_method(RaffleSmsService, :purchase_confirmation, sms_stub) do
        post "/api/v1/tournaments/#{@tournament.id}/raffle/sell",
             params: {
               quantity: 4,
               price_cents: 2000,
               buyer_name: "Cash Buyer",
               buyer_phone: "+16715550123"
             },
             headers: @headers
      end
      end
    end

    assert_response :created
    json = JSON.parse(response.body)
    sale_batch = @tournament.raffle_sale_batches.last
    assert_equal "Cash Buyer", sale_batch.buyer_name
    assert_equal 4, sale_batch.quantity
    assert_equal 2000, sale_batch.total_cents
    assert_equal [ sale_batch.id ], @tournament.raffle_tickets.order(:created_at).last(4).map(&:raffle_sale_batch_id).uniq
    assert_equal false, json.dig("delivery", "sms", "success")
    assert_equal false, json.dig("delivery", "sms", "skipped")
    assert_equal "Carrier rejected message", json.dig("delivery", "sms", "error")
    assert_equal true, json.dig("delivery", "email", "skipped")
    assert_equal 1, sms_calls.size
    assert_equal 4, sms_calls.first.fetch(:count)
    assert_equal "+16715550123", sms_calls.first.fetch(:buyer_phone)
    assert_equal "Cash Buyer", sms_calls.first.fetch(:buyer_name)
    assert_equal @tournament, sms_calls.first.fetch(:tournament)

    log = ActivityLog.where(action: "raffle_tickets_sold").last
    assert_equal "Carrier rejected message", log.metadata.dig("delivery", "sms", "error")
  end

  test "sell tickets treats nil SMS delivery result as skipped service" do
    sms_stub = ->(tickets:, buyer_phone:, buyer_name:, tournament:) { nil }

    assert_difference -> { @tournament.raffle_tickets.count }, 2 do
      with_singleton_method(RaffleSmsService, :purchase_confirmation, sms_stub) do
        post "/api/v1/tournaments/#{@tournament.id}/raffle/sell",
             params: {
               quantity: 2,
               price_cents: 1000,
               buyer_name: "Cash Buyer",
               buyer_phone: "+16715550123"
             },
             headers: @headers
      end
    end

    assert_response :created
    json = JSON.parse(response.body)
    assert_equal false, json.dig("delivery", "sms", "success")
    assert_equal true, json.dig("delivery", "sms", "skipped")
    assert_equal "Delivery service not configured", json.dig("delivery", "sms", "error")

    log = ActivityLog.where(action: "raffle_tickets_sold").last
    assert_equal true, log.metadata.dig("delivery", "sms", "skipped")
    assert_equal "Delivery service not configured", log.metadata.dig("delivery", "sms", "error")
  end

  test "sell tickets requires buyer name" do
    assert_no_difference -> { @tournament.raffle_tickets.count } do
      post "/api/v1/tournaments/#{@tournament.id}/raffle/sell",
           params: {
             quantity: 2,
             price_cents: 1000,
             buyer_phone: "+16715550123"
           },
           headers: @headers
    end

    assert_response :unprocessable_entity
    assert_match "Buyer name is required", JSON.parse(response.body).fetch("error")
  end

  test "resend ticket confirmation sends the original sale group and logs delivery results" do
    same_buyer_extra = @tournament.raffle_tickets.create!(
      purchaser_name: "Walk-up buyer",
      purchaser_email: "buyer@example.com",
      purchaser_phone: "+16715550123",
      price_cents: 500,
      payment_status: "paid",
      purchased_at: 10.minutes.ago,
      sold_by_user_id: @admin.id
    )

    sale_tickets = 3.times.map do |idx|
      @tournament.raffle_tickets.create!(
        purchaser_name: "Walk-up buyer",
        purchaser_email: "buyer@example.com",
        purchaser_phone: "+16715550123",
        price_cents: idx == 2 ? 668 : 666,
        payment_status: "paid",
        purchased_at: Time.current,
        sold_by_user_id: @admin.id
      )
    end

    ActivityLog.log(
      admin: @admin,
      action: "raffle_tickets_sold",
      target: @tournament,
      details: "Sold 3 ticket(s) for $20.0 to Walk-up buyer",
      metadata: {
        quantity: 3,
        total_cents: 2000,
        buyer_name: "Walk-up buyer",
        buyer_email: "buyer@example.com",
        buyer_phone: "+16715550123",
        ticket_numbers: sale_tickets.map(&:ticket_number)
      },
      tournament: @tournament
    )

    sms_calls = []
    email_calls = []
    sms_stub = lambda do |tickets:, buyer_phone:, buyer_name:, tournament:|
      sms_calls << {
        ticket_numbers: tickets.map(&:ticket_number),
        buyer_phone: buyer_phone,
        buyer_name: buyer_name,
        tournament: tournament
      }
      { success: true, message_id: "sms_123" }
    end
    email_stub = lambda do |tickets:, buyer_email:, buyer_name:, tournament:|
      email_calls << {
        ticket_numbers: tickets.map(&:ticket_number),
        buyer_email: buyer_email,
        buyer_name: buyer_name,
        tournament: tournament
      }
      { success: true, data: { id: "email_123" } }
    end

    assert_difference -> { ActivityLog.where(action: "raffle_ticket_confirmation_resent").count }, 1 do
      with_singleton_method(RaffleSmsService, :purchase_confirmation, sms_stub) do
        with_singleton_method(RaffleMailer, :purchase_confirmation_email, email_stub) do
          post "/api/v1/tournaments/#{@tournament.id}/raffle/tickets/#{sale_tickets.first.id}/resend_confirmation",
               params: { buyer_email: "", buyer_phone: "+16715550999" },
               headers: @headers
        end
      end
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 3, json.fetch("ticket_count")
    assert_equal sale_tickets.map(&:display_number), json.fetch("ticket_numbers")
    assert_equal true, json.dig("delivery", "sms", "success")
    assert_equal true, json.dig("delivery", "email", "skipped")

    assert_equal 1, sms_calls.size
    assert_equal sale_tickets.map(&:ticket_number), sms_calls.first.fetch(:ticket_numbers)
    assert_equal "+16715550999", sms_calls.first.fetch(:buyer_phone)
    assert_equal @tournament, sms_calls.first.fetch(:tournament)

    assert_empty email_calls
    assert_not_includes json.fetch("ticket_numbers"), same_buyer_extra.display_number

    log = ActivityLog.where(action: "raffle_ticket_confirmation_resent").last
    assert_equal sale_tickets.map(&:display_number), log.metadata.fetch("ticket_numbers")
    assert_equal "+16715550999", log.metadata.fetch("buyer_phone")
    assert_equal "sms_123", log.metadata.dig("delivery", "sms", "message_id")

    assert_equal ["+16715550999"], sale_tickets.map { |ticket| ticket.reload.purchaser_phone }.uniq
    assert_equal ["buyer@example.com"], sale_tickets.map { |ticket| ticket.reload.purchaser_email }.uniq
    assert_equal "+16715550123", same_buyer_extra.reload.purchaser_phone
  end

  test "resend ticket confirmation does not persist corrected contact when delivery fails" do
    tickets = 2.times.map do
      @tournament.raffle_tickets.create!(
        purchaser_name: "Wrong Contact",
        purchaser_email: "old@example.com",
        purchaser_phone: "+16715550123",
        price_cents: 1000,
        payment_status: "paid",
        purchased_at: Time.current,
        sold_by_user_id: @admin.id
      )
    end

    ActivityLog.log(
      admin: @admin,
      action: "raffle_tickets_sold",
      target: @tournament,
      details: "Sold 2 ticket(s) for $20.0 to Wrong Contact",
      metadata: {
        buyer_name: "Wrong Contact",
        buyer_email: "old@example.com",
        buyer_phone: "+16715550123",
        ticket_numbers: tickets.map(&:ticket_number)
      },
      tournament: @tournament
    )

    sms_stub = ->(tickets:, buyer_phone:, buyer_name:, tournament:) { { success: false, error: "Carrier rejected message" } }

    assert_no_difference -> { ActivityLog.where(action: "raffle_ticket_confirmation_resent").count } do
      with_singleton_method(RaffleSmsService, :purchase_confirmation, sms_stub) do
        post "/api/v1/tournaments/#{@tournament.id}/raffle/tickets/#{tickets.first.id}/resend_confirmation",
             params: { buyer_email: "", buyer_phone: "+16715550999" },
             headers: @headers
      end
    end

    assert_response :bad_gateway
    assert_equal ["+16715550123"], tickets.map { |ticket| ticket.reload.purchaser_phone }.uniq
    assert_equal ["old@example.com"], tickets.map { |ticket| ticket.reload.purchaser_email }.uniq
  end

  test "resend ticket confirmation rejects tickets without delivery contact" do
    ticket = @tournament.raffle_tickets.create!(
      purchaser_name: "Cash Buyer",
      purchaser_email: nil,
      purchaser_phone: nil,
      price_cents: 500,
      payment_status: "paid",
      purchased_at: Time.current,
      sold_by_user_id: @admin.id
    )

    post "/api/v1/tournaments/#{@tournament.id}/raffle/tickets/#{ticket.id}/resend_confirmation",
         headers: @headers

    assert_response :unprocessable_entity
    assert_match "no email or phone", JSON.parse(response.body).fetch("error")
  end

  test "resend ticket confirmation does not group anonymous tickets without a sale log" do
    matching_contact = @tournament.raffle_tickets.create!(
      purchaser_name: "Cash Buyer",
      purchaser_email: nil,
      purchaser_phone: "+16715550123",
      price_cents: 500,
      payment_status: "paid",
      purchased_at: Time.current,
      sold_by_user_id: @admin.id
    )

    anonymous_ticket = @tournament.raffle_tickets.create!(
      purchaser_name: "Cash Buyer",
      purchaser_email: nil,
      purchaser_phone: nil,
      price_cents: 500,
      payment_status: "paid",
      purchased_at: nil,
      sold_by_user_id: @admin.id
    )
    unrelated_anonymous_ticket = @tournament.raffle_tickets.create!(
      purchaser_name: "Cash Buyer",
      purchaser_email: nil,
      purchaser_phone: nil,
      price_cents: 500,
      payment_status: "paid",
      purchased_at: nil,
      sold_by_user_id: @admin.id
    )
    anonymous_ticket.update_columns(purchaser_name: nil)
    unrelated_anonymous_ticket.update_columns(purchaser_name: nil)

    sms_calls = []
    sms_stub = lambda do |tickets:, buyer_phone:, buyer_name:, tournament:|
      sms_calls << tickets.map(&:ticket_number)
      { success: true, message_id: "sms_anon" }
    end

    assert_no_difference -> { ActivityLog.where(action: "raffle_ticket_confirmation_resent").count } do
      with_singleton_method(RaffleSmsService, :purchase_confirmation, sms_stub) do
        post "/api/v1/tournaments/#{@tournament.id}/raffle/tickets/#{anonymous_ticket.id}/resend_confirmation",
             params: { buyer_phone: "+16715550999" },
             headers: @headers
      end
    end

    assert_response :unprocessable_entity
    assert_empty sms_calls
    assert_equal "+16715550123", matching_contact.reload.purchaser_phone
    assert_nil anonymous_ticket.reload.purchaser_phone
    assert_nil unrelated_anonymous_ticket.reload.purchaser_phone
  end

  test "resend ticket confirmation without sale log and purchase time only sends selected ticket" do
    selected_ticket = @tournament.raffle_tickets.create!(
      purchaser_name: "Cash Buyer",
      purchaser_email: nil,
      purchaser_phone: "+16715550123",
      price_cents: 500,
      payment_status: "paid",
      purchased_at: nil,
      sold_by_user_id: @admin.id
    )
    unrelated_same_contact = @tournament.raffle_tickets.create!(
      purchaser_name: "Cash Buyer",
      purchaser_email: nil,
      purchaser_phone: "+16715550123",
      price_cents: 500,
      payment_status: "paid",
      purchased_at: nil,
      sold_by_user_id: @admin.id
    )

    sms_calls = []
    sms_stub = lambda do |tickets:, buyer_phone:, buyer_name:, tournament:|
      sms_calls << {
        ticket_numbers: tickets.map(&:ticket_number),
        buyer_phone: buyer_phone,
        buyer_name: buyer_name,
        tournament: tournament
      }
      { success: true, message_id: "sms_selected" }
    end

    assert_difference -> { ActivityLog.where(action: "raffle_ticket_confirmation_resent").count }, 1 do
      with_singleton_method(RaffleSmsService, :purchase_confirmation, sms_stub) do
        post "/api/v1/tournaments/#{@tournament.id}/raffle/tickets/#{selected_ticket.id}/resend_confirmation",
             params: { buyer_phone: "+16715550999" },
             headers: @headers
      end
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 1, json.fetch("ticket_count")
    assert_equal [selected_ticket.display_number], json.fetch("ticket_numbers")
    assert_equal 1, sms_calls.size
    assert_equal [selected_ticket.ticket_number], sms_calls.first.fetch(:ticket_numbers)
    assert_equal "+16715550999", selected_ticket.reload.purchaser_phone
    assert_equal "+16715550123", unrelated_same_contact.reload.purchaser_phone
  end

  test "resend winner notification returns delivery status and logs results" do
    ticket = @tournament.raffle_tickets.create!(
      purchaser_name: "Winner Person",
      purchaser_email: "winner@example.com",
      purchaser_phone: "+16715550123",
      price_cents: 500,
      payment_status: "paid",
      purchased_at: Time.current,
      is_winner: true
    )
    prize = @tournament.raffle_prizes.create!(
      name: "Golf Bag",
      tier: "standard",
      value_cents: 30000,
      won: true,
      won_at: Time.current,
      winning_ticket: ticket,
      winner_name: "Winner Person",
      winner_email: "winner@example.com",
      winner_phone: "+16715550123"
    )
    ticket.update!(raffle_prize: prize)

    email_stub = ->(raffle_prize) { { success: true, data: { id: "email_winner_123" } } }
    sms_stub = ->(raffle_prize:) { { success: false, error: "Carrier rejected winner SMS" } }

    assert_difference -> { ActivityLog.where(action: "raffle_winner_notification_resent").count }, 1 do
      with_singleton_method(RaffleMailer, :winner_email, email_stub) do
        with_singleton_method(RaffleSmsService, :winner_notification, sms_stub) do
          post "/api/v1/tournaments/#{@tournament.id}/raffle/prizes/#{prize.id}/resend_notification",
               headers: @headers
        end
      end
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json.dig("delivery", "email", "success")
    assert_equal false, json.dig("delivery", "sms", "success")
    assert_equal "Carrier rejected winner SMS", json.dig("delivery", "sms", "error")

    log = ActivityLog.where(action: "raffle_winner_notification_resent").last
    assert_equal [ "email" ], log.metadata.fetch("channels")
    assert_equal "Carrier rejected winner SMS", log.metadata.dig("delivery", "sms", "error")
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

  test "delivery summary masks recipient values for activity logs" do
    controller = Api::V1::RaffleController.new

    assert_equal "w***@example.com", controller.send(:mask_delivery_recipient, "winner@example.com")
    assert_equal "****0123", controller.send(:mask_delivery_recipient, "+16715550123")
    assert_equal "****", controller.send(:mask_delivery_recipient, "abc")
    assert_nil controller.send(:mask_delivery_recipient, nil)
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

  def with_singleton_method(klass, method_name, replacement)
    original = klass.method(method_name)
    klass.define_singleton_method(method_name, &replacement)
    yield
  ensure
    klass.define_singleton_method(method_name) do |*args, **kwargs, &block|
      original.call(*args, **kwargs, &block)
    end
  end
end
