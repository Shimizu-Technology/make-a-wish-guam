# frozen_string_literal: true

require "mini_magick"

module Api
  module V1
    module Admin
      class UploadsController < ApplicationController
        include Authenticated

        ALLOWED_IMAGE_TYPES = %w[
          image/jpeg
          image/png
          image/gif
          image/svg+xml
          image/webp
          image/avif
        ].freeze

        before_action :require_branding_access!

        # POST /api/v1/admin/uploads
        # Accepts a file upload and returns the URL
        def create
          unless params[:file]
            return render json: { error: "No file provided" }, status: :bad_request
          end

          file = params[:file]
          upload_io = nil

          # Validate file type
          unless ALLOWED_IMAGE_TYPES.include?(file.content_type)
            return render json: {
              error: "Invalid file type. Allowed: JPEG, PNG, GIF, SVG, WebP, AVIF"
            }, status: :unprocessable_entity
          end

          # Validate file size (max 5MB)
          if file.size > 5.megabytes
            return render json: {
              error: "File too large. Maximum size is 5MB"
            }, status: :unprocessable_entity
          end

          upload_io, filename, content_type = prepared_upload(file)

          # Create an Active Storage blob and attach it
          blob = ActiveStorage::Blob.create_and_upload!(
            io: upload_io,
            filename: filename,
            content_type: content_type
          )

          # Return the URL
          url = Rails.application.routes.url_helpers.rails_blob_url(
            blob,
            host: request.base_url
          )

          render json: {
            url: url,
            filename: blob.filename.to_s,
            content_type: blob.content_type,
            byte_size: blob.byte_size
          }, status: :created
        rescue MiniMagick::Error, MiniMagick::Invalid => e
          Rails.logger.warn("AVIF upload normalization failed: #{e.class}: #{e.message}")
          render json: {
            error: "Could not process that AVIF image. Please export it again and retry."
          }, status: :unprocessable_entity
        ensure
          upload_io&.close! if upload_io.is_a?(Tempfile)
        end

        # POST /api/v1/admin/uploads/presigned
        # Returns a presigned URL for direct upload (future S3 support)
        def presigned
          blob = ActiveStorage::Blob.create_before_direct_upload!(
            filename: params[:filename],
            byte_size: params[:byte_size],
            checksum: params[:checksum],
            content_type: params[:content_type]
          )

          render json: {
            upload_url: blob.service_url_for_direct_upload,
            signed_id: blob.signed_id,
            headers: blob.service_headers_for_direct_upload
          }
        end

        private

        def prepared_upload(file)
          return [ file, file.original_filename, file.content_type ] unless file.content_type == "image/avif"

          normalized_file = Tempfile.new([ File.basename(file.original_filename, ".*"), ".webp" ])
          normalized_file.binmode

          begin
            image = MiniMagick::Image.open(file.tempfile.path)
            image.auto_orient
            image.format("webp")
            image.write(normalized_file.path)
            normalized_file.rewind
          rescue MiniMagick::Error, MiniMagick::Invalid
            normalized_file.close!
            raise
          end

          [ normalized_file, "#{File.basename(file.original_filename, ".*")}.webp", "image/webp" ]
        end

        def require_branding_access!
          return if current_user&.super_admin?
          return if current_user&.organization_memberships&.admins&.exists?

          render json: { error: 'Forbidden: Organization admin access required' }, status: :forbidden
        end
      end
    end
  end
end
