require "test_helper"

class Api::V1::RaffleControllerTest < ActionDispatch::IntegrationTest
  setup do
    @tournament = tournaments(:tournament_one)
    @admin = users(:user_one)
    @admin.update!(clerk_id: "test_clerk_raffle_#{@admin.id}") if @admin.clerk_id.blank?
    OrganizationMembership.find_or_create_by!(user: @admin, organization: @tournament.organization) do |membership|
      membership.role = "admin"
    end
    @headers = { "Authorization" => "Bearer test_token_#{@admin.id}" }
  end

  test "admin can create a raffle prize with an uploaded image" do
    file = Rack::Test::UploadedFile.new(
      Rails.root.join("test/fixtures/files/test.svg"),
      "image/svg+xml"
    )

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
    image_file = File.open(Rails.root.join("test/fixtures/files/test.svg"))
    prize.image.attach(
      io: image_file,
      filename: "test.svg",
      content_type: "image/svg+xml"
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
    assert_includes JSON.parse(response.body).fetch("error"), "Image must be JPEG"
  ensure
    tempfile&.close!
  end

  test "admin can remove an uploaded prize image" do
    prize = @tournament.raffle_prizes.create!(
      name: "Golf Bag",
      tier: "standard",
      value_cents: 30000
    )
    image_file = File.open(Rails.root.join("test/fixtures/files/test.svg"))
    prize.image.attach(
      io: image_file,
      filename: "test.svg",
      content_type: "image/svg+xml"
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
end
