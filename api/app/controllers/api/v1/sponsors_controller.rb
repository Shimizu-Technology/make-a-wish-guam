# frozen_string_literal: true

module Api
  module V1
    class SponsorsController < BaseController
      skip_before_action :authenticate_user!, only: [:index, :show, :by_hole]
      before_action :set_tournament
      before_action :set_sponsor, only: [:show, :update, :destroy]
      before_action :authorize_tournament_admin!, only: [:create, :update, :destroy, :reorder]

      # GET /api/v1/tournaments/:tournament_id/sponsors
      # Public - get all sponsors grouped by tier
      def index
        sponsors = @tournament.sponsors.active.ordered

        # Group by tier for display
        grouped = Sponsor::TIERS.each_with_object({}) do |tier, hash|
          tier_sponsors = sponsors.select { |s| s.tier == tier }
          hash[tier] = tier_sponsors.map { |s| sponsor_response(s) } if tier_sponsors.any?
        end

        render json: {
          sponsors: sponsors.map { |s| sponsor_response(s) },
          by_tier: grouped,
          stats: {
            total: sponsors.count,
            title: sponsors.count { |s| s.tier == 'title' },
            major: sponsors.count(&:major?),
            hole: sponsors.count(&:hole_sponsor?)
          }
        }
      end

      # GET /api/v1/tournaments/:tournament_id/sponsors/:id
      # Public - get single sponsor
      def show
        render json: { sponsor: sponsor_response(@sponsor) }
      end

      # GET /api/v1/tournaments/:tournament_id/sponsors/by_hole
      # Public - get hole sponsors indexed by hole number
      def by_hole
        hole_sponsors = @tournament.sponsors.active.hole_sponsors

        by_hole = (1..18).each_with_object({}) do |hole, hash|
          sponsor = hole_sponsors.find { |s| s.hole_number == hole }
          hash[hole] = sponsor_response(sponsor) if sponsor
        end

        render json: { by_hole: by_hole }
      end

      # POST /api/v1/tournaments/:tournament_id/sponsors
      # Admin - create sponsor
      def create
        sponsor = @tournament.sponsors.build(sponsor_params)

        if sponsor.save
          render json: { sponsor: sponsor_response(sponsor), message: 'Sponsor created' }, status: :created
        else
          render json: { error: sponsor.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/tournaments/:tournament_id/sponsors/:id
      # Admin - update sponsor
      def update
        if @sponsor.update(sponsor_params)
          render json: { sponsor: sponsor_response(@sponsor), message: 'Sponsor updated' }
        else
          render json: { error: @sponsor.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/tournaments/:tournament_id/sponsors/:id
      # Admin - delete sponsor
      def destroy
        @sponsor.destroy
        render json: { message: 'Sponsor deleted' }
      end

      # POST /api/v1/tournaments/:tournament_id/sponsors/reorder
      # Admin - reorder sponsors within a tier
      def reorder
        positions = params[:positions] || []
        
        ActiveRecord::Base.transaction do
          positions.each_with_index do |id, index|
            @tournament.sponsors.find(id).update!(position: index)
          end
        end

        render json: { message: 'Sponsors reordered' }
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Sponsor not found' }, status: :not_found
      end

      private

      def set_tournament
        @tournament = Tournament.find(params[:tournament_id])
      end

      def authorize_tournament_admin!
        require_tournament_admin!(@tournament)
      end

      def set_sponsor
        @sponsor = @tournament.sponsors.find(params[:id])
      end

      def sponsor_params
        params.require(:sponsor).permit(
          :name, :tier, :logo_url, :website_url, :description,
          :hole_number, :position, :active
        )
      end

      def sponsor_response(sponsor)
        {
          id: sponsor.id,
          name: sponsor.name,
          tier: sponsor.tier,
          tier_display: sponsor.tier_display,
          logo_url: sponsor.logo_url,
          website_url: sponsor.website_url,
          description: sponsor.description,
          hole_number: sponsor.hole_number,
          position: sponsor.position,
          active: sponsor.active,
          major: sponsor.major?,
          display_label: sponsor.display_label
        }
      end
    end
  end
end
