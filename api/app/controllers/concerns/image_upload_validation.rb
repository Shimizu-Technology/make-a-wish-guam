# frozen_string_literal: true

require "mini_magick"
require "marcel"
require "pathname"

module ImageUploadValidation
  extend ActiveSupport::Concern

  ALLOWED_IMAGE_TYPES = %w[
    image/jpeg
    image/png
    image/gif
    image/webp
    image/avif
  ].freeze

  MAGICK_IMAGE_TYPES = {
    "JPEG" => "image/jpeg",
    "PNG" => "image/png",
    "GIF" => "image/gif",
    "WEBP" => "image/webp",
    "AVIF" => "image/avif",
    "HEIF" => "image/avif",
    "HEIC" => "image/avif"
  }.freeze

  private

  def verified_image_content_type(upload)
    detected_type = Marcel::MimeType.for(Pathname.new(upload.tempfile.path))
    return nil unless ALLOWED_IMAGE_TYPES.include?(detected_type)

    image = MiniMagick::Image.open(upload.tempfile.path)
    magick_type = MAGICK_IMAGE_TYPES[image.type&.upcase]

    return detected_type if magick_type == detected_type
  rescue MiniMagick::Error, MiniMagick::Invalid => e
    Rails.logger.warn("Invalid image upload: #{e.class}: #{e.message}")
    nil
  end
end
