# frozen_string_literal: true

module Api
  module V1
    class GolferAuthController < ApplicationController
      # Skip Clerk authentication - this controller handles golfer auth
      skip_before_action :verify_authenticity_token, raise: false

      # POST /api/v1/golfer_auth/request_link
      # Request a magic link for scoring access
      def request_link
        email = params[:email]&.strip&.downcase

        if email.blank?
          return render json: { 
            success: false, 
            error: "Email is required" 
          }, status: :bad_request
        end

        # Find golfers for this email in active tournaments
        golfers = Golfer.find_for_scoring_access(email)

        if golfers.empty?
          # Don't reveal if email exists - security best practice
          # But still return success to prevent email enumeration
          Rails.logger.info("GolferAuth: No active registration found for #{email}")
          return render json: {
            success: true,
            message: "If you have an active registration, you'll receive an email with your access link."
          }
        end

        # Generate magic link for the most recent tournament registration
        golfer = golfers.first
        golfer.generate_magic_link!

        # Send the magic link email
        begin
          GolferMailer.scoring_access_email(golfer).deliver_later
          Rails.logger.info("GolferAuth: Magic link sent to #{email} for tournament #{golfer.tournament_id}")
        rescue StandardError => e
          Rails.logger.error("GolferAuth: Failed to send magic link email - #{e.message}")
          # Don't fail the request if email fails - they can retry
        end

        render json: {
          success: true,
          message: "If you have an active registration, you'll receive an email with your access link."
        }
      end

      # GET /api/v1/golfer_auth/verify
      # Verify a magic link token and return session JWT
      def verify
        token = params[:token]

        if token.blank?
          return render json: { 
            success: false, 
            error: "Token is required" 
          }, status: :bad_request
        end

        golfer = Golfer.find_by_magic_link(token)

        if golfer.nil?
          return render json: { 
            success: false, 
            error: "Invalid or expired link. Please request a new one." 
          }, status: :unauthorized
        end

        # Generate session JWT
        session_token = GolferAuth.generate_token(golfer)

        # Clear the magic link (one-time use)
        golfer.clear_magic_link!

        # Return golfer info and session token
        render json: {
          success: true,
          token: session_token,
          golfer: golfer_response(golfer),
          tournament: tournament_response(golfer.tournament),
          group: golfer.group ? group_response(golfer.group) : nil
        }
      end

      # GET /api/v1/golfer_auth/me
      # Get current golfer info (requires golfer JWT)
      def me
        golfer = authenticate_golfer!
        return unless golfer

        render json: {
          success: true,
          golfer: golfer_response(golfer),
          tournament: tournament_response(golfer.tournament),
          group: golfer.group ? group_response(golfer.group) : nil
        }
      end

      # POST /api/v1/golfer_auth/refresh
      # Refresh the session token
      def refresh
        golfer = authenticate_golfer!
        return unless golfer

        new_token = GolferAuth.generate_token(golfer)

        render json: {
          success: true,
          token: new_token
        }
      end

      private

      def authenticate_golfer!
        header = request.headers["Authorization"]

        unless header.present?
          render json: { success: false, error: "Authorization required" }, status: :unauthorized
          return nil
        end

        token = header.split(" ").last
        golfer = GolferAuth.golfer_from_token(token)

        unless golfer
          render json: { success: false, error: "Invalid or expired session" }, status: :unauthorized
          return nil
        end

        golfer
      end

      def golfer_response(golfer)
        {
          id: golfer.id,
          name: golfer.name,
          email: golfer.email,
          phone: golfer.phone,
          registration_status: golfer.registration_status,
          payment_status: golfer.payment_status,
          checked_in: golfer.checked_in?,
          group_id: golfer.group_id,
          hole_position: golfer.hole_position_label
        }
      end

      def tournament_response(tournament)
        {
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          year: tournament.year,
          status: tournament.status,
          event_date: tournament.event_date,
          location_name: tournament.location_name,
          start_time: tournament.start_time,
          format: tournament.tournament_format,
          team_size: tournament.team_size,
          total_holes: tournament.total_holes || 18,
          total_par: tournament.total_par || 72,
          organization: tournament.organization ? {
            id: tournament.organization.id,
            name: tournament.organization.name,
            slug: tournament.organization.slug
          } : nil
        }
      end

      def group_response(group)
        {
          id: group.id,
          group_number: group.group_number,
          hole_number: group.hole_number,
          golfers: group.golfers.map do |g|
            {
              id: g.id,
              name: g.name,
              checked_in: g.checked_in?
            }
          end
        }
      end
    end
  end
end
