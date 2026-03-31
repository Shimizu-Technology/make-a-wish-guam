# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UploadsController < ApplicationController
        include Authenticated

        before_action :require_super_admin!

        # POST /api/v1/admin/uploads
        # Accepts a file upload and returns the URL
        def create
          unless params[:file]
            return render json: { error: "No file provided" }, status: :bad_request
          end

          file = params[:file]

          # Validate file type
          allowed_types = %w[image/jpeg image/png image/gif image/svg+xml image/webp]
          unless allowed_types.include?(file.content_type)
            return render json: {
              error: "Invalid file type. Allowed: JPEG, PNG, GIF, SVG, WebP"
            }, status: :unprocessable_entity
          end

          # Validate file size (max 5MB)
          if file.size > 5.megabytes
            return render json: {
              error: "File too large. Maximum size is 5MB"
            }, status: :unprocessable_entity
          end

          # Create an Active Storage blob and attach it
          blob = ActiveStorage::Blob.create_and_upload!(
            io: file,
            filename: file.original_filename,
            content_type: file.content_type
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
      end
    end
  end
end
