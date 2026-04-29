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

    assert_response :created
    json = JSON.parse(response.body)
    assert_match %r{\Ahttp://www.example.com/rails/active_storage/blobs/}, json.dig("prize", "image_url")

    prize = RafflePrize.find(json.dig("prize", "id"))
    assert prize.image.attached?
    assert_match %r{\Ahttp://www.example.com/rails/active_storage/blobs/}, prize.image_url
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

  test "imagemagick avif container aliases are accepted" do
    assert_equal "image/avif", Api::V1::RaffleController::MAGICK_IMAGE_TYPES.fetch("HEIF")
    assert_equal "image/avif", Api::V1::RaffleController::MAGICK_IMAGE_TYPES.fetch("HEIC")
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

    assert_response :success
    json = JSON.parse(response.body)
    assert_nil json.dig("prize", "image_url")

    prize.reload
    assert_not prize.image.attached?
    assert_nil prize.image_url
  ensure
    image_file&.close
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
