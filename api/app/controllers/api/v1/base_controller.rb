module Api
  module V1
    class BaseController < ApplicationController
      include Authenticated

      # Standardized error handling
      rescue_from ActiveRecord::RecordNotFound, with: :record_not_found
      rescue_from ActiveRecord::RecordInvalid, with: :record_invalid
      rescue_from ActionController::ParameterMissing, with: :parameter_missing
      rescue_from ArgumentError, with: :bad_request_error
      rescue_from StandardError, with: :internal_server_error if Rails.env.production?

      private

      # Standardized error response format
      def render_error(message, status: :bad_request, code: nil, details: nil)
        response = {
          success: false,
          error: {
            message: message,
            code: code || status.to_s.upcase,
            status: Rack::Utils.status_code(status)
          }
        }
        response[:error][:details] = details if details.present?
        
        render json: response, status: status
      end

      def render_success(data = nil, message: nil, status: :ok, meta: nil)
        response = { success: true }
        response[:message] = message if message.present?
        response[:data] = data if data.present?
        response[:meta] = meta if meta.present?
        
        render json: response, status: status
      end

      def record_not_found(exception)
        render_error(
          "The requested resource was not found",
          status: :not_found,
          code: 'NOT_FOUND',
          details: exception.message
        )
      end

      def record_invalid(exception)
        render_error(
          "Validation failed",
          status: :unprocessable_entity,
          code: 'VALIDATION_ERROR',
          details: exception.record.errors.full_messages
        )
      end

      def parameter_missing(exception)
        render_error(
          "Required parameter missing",
          status: :bad_request,
          code: 'MISSING_PARAMETER',
          details: exception.message
        )
      end

      def bad_request_error(exception)
        render_error(
          exception.message,
          status: :bad_request,
          code: 'BAD_REQUEST'
        )
      end

      def internal_server_error(exception)
        Rails.logger.error "Internal Server Error: #{exception.message}\n#{exception.backtrace.first(10).join("\n")}"
        
        render_error(
          "An unexpected error occurred",
          status: :internal_server_error,
          code: 'INTERNAL_ERROR'
        )
      end

      def paginate(collection)
        collection.page(params[:page] || 1).per(params[:per_page] || 25)
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages: collection.total_pages,
          total_count: collection.total_count,
          per_page: collection.limit_value
        }
      end
    end
  end
end

