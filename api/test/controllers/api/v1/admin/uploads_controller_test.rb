require "test_helper"
require "mini_magick"
require "tempfile"

class Api::V1::Admin::UploadsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @tempfiles = []
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_upload_admin_#{@admin.id}") if @admin.clerk_id.nil?
  end

  def teardown
    @tempfiles.each(&:close!)
  end

  test "create allows an organization admin membership" do
    authenticate_as(@admin)

    assert_difference "ActiveStorage::Blob.count", 1 do
      post "/api/v1/admin/uploads",
           params: {
             file: build_png_upload
           },
           headers: auth_headers
    end

    assert_response :created
    json = JSON.parse(response.body)
    assert_match %r{/rails/active_storage/blobs/}, json["url"]
  end

  test "create rejects a volunteer even if the user has a broad global role" do
    volunteer = User.create!(
      email: "volunteer-upload@example.com",
      role: "org_admin",
      clerk_id: "volunteer_upload_#{SecureRandom.hex(4)}"
    )
    OrganizationMembership.create!(
      organization: organizations(:org_one),
      user: volunteer,
      role: "volunteer"
    )

    authenticate_as(volunteer)

    assert_no_difference "ActiveStorage::Blob.count" do
      post "/api/v1/admin/uploads",
           params: {
             file: build_png_upload
           },
           headers: auth_headers
    end

    assert_response :forbidden
  end

  test "create accepts avif uploads and normalizes them to webp" do
    authenticate_as(@admin)

    avif_upload = build_avif_upload

    assert_difference "ActiveStorage::Blob.count", 1 do
      post "/api/v1/admin/uploads",
           params: {
             file: avif_upload
           },
           headers: auth_headers
    end

    assert_response :created

    json = JSON.parse(response.body)
    assert_equal "image/webp", json["content_type"]
    assert_equal "banner.webp", json["filename"]
    assert_match %r{/rails/active_storage/blobs/}, json["url"]
  ensure
    avif_upload&.tempfile&.close!
  end

  test "create closes normalized tempfile when avif processing fails" do
    avif_upload = build_avif_upload
    normalized_file = UploadTempfileDouble.new
    original_tempfile_new = Tempfile.method(:new)
    original_image_open = MiniMagick::Image.method(:open)
    controller = Api::V1::Admin::UploadsController.new

    Tempfile.singleton_class.send(:define_method, :new) do |*|
      normalized_file
    end

    MiniMagick::Image.singleton_class.send(:define_method, :open) do |*|
      raise MiniMagick::Error, "boom"
    end

    assert_raises(MiniMagick::Error) do
      controller.send(:prepared_upload, avif_upload, "image/avif")
    end

    assert normalized_file.closed?, "normalized tempfile should be closed when avif normalization fails"
  ensure
    Tempfile.singleton_class.send(:define_method, :new, original_tempfile_new)
    MiniMagick::Image.singleton_class.send(:define_method, :open, original_image_open)
    avif_upload&.tempfile&.close!
  end

  test "create rejects spoofed image content type" do
    authenticate_as(@admin)

    tempfile = Tempfile.new([ "spoofed-upload", ".jpg" ])
    tempfile.write("not actually a jpeg")
    tempfile.rewind

    upload = Rack::Test::UploadedFile.new(
      tempfile.path,
      "image/jpeg",
      original_filename: "upload.jpg"
    )

    assert_no_difference "ActiveStorage::Blob.count" do
      post "/api/v1/admin/uploads",
           params: { file: upload },
           headers: auth_headers
    end

    assert_response :unprocessable_entity
    assert_equal "Invalid file type. Allowed: JPEG, PNG, GIF, WebP, AVIF", JSON.parse(response.body)["error"]
  ensure
    tempfile&.close!
  end

  private

  class UploadTempfileDouble
    attr_reader :path

    def initialize
      @path = "/tmp/fake-normalized.webp"
      @closed = false
    end

    def binmode; end

    def rewind; end

    def close!
      @closed = true
    end

    def closed?
      @closed
    end
  end

  def build_png_upload
    file = Tempfile.new([ "upload", ".png" ])
    file.binmode

    system("magick", "-size", "16x16", "xc:#0057B8", file.path, exception: true)
    file.rewind

    @tempfiles << file
    Rack::Test::UploadedFile.new(file.path, "image/png", original_filename: "upload.png")
  end

  def build_avif_upload
    source_file = Tempfile.new([ "upload-source", ".png" ])
    source_file.binmode

    system("magick", "-size", "16x16", "xc:#0057B8", source_file.path, exception: true)

    avif_file = Tempfile.new([ "banner", ".avif" ])
    avif_file.binmode

    image = MiniMagick::Image.open(source_file.path)
    image.format("avif")
    image.write(avif_file.path)
    avif_file.rewind

    Rack::Test::UploadedFile.new(avif_file.path, "image/avif", original_filename: "banner.avif")
  ensure
    source_file&.close!
  end
end
