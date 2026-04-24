# frozen_string_literal: true

module Api
  module V1
    class SponsorsController < BaseController
      skip_before_action :authenticate_user!, only: [:index, :show, :by_hole]
      before_action :set_tournament
      before_action :set_sponsor, only: [:show, :update, :destroy, :slots, :update_slot]
      before_action :authorize_tournament_admin!, only: [:create, :update, :destroy, :reorder, :slots, :update_slot]

      # GET /api/v1/tournaments/:tournament_id/sponsors
      # Public - get all sponsors grouped by tier
      def index
        sponsors = @tournament.sponsors.active.ordered.includes(logo_attachment: :blob)
        tier_keys = @tournament.sponsor_tier_keys

        grouped = tier_keys.each_with_object({}) do |tier, hash|
          tier_sponsors = sponsors.select { |s| s.tier == tier }
          hash[tier] = tier_sponsors.map { |s| sponsor_response(s) } if tier_sponsors.any?
        end

        render json: {
          sponsors: sponsors.map { |s| sponsor_response(s) },
          by_tier: grouped,
          tier_definitions: @tournament.sponsor_tier_list,
          stats: {
            total: sponsors.count,
            title: sponsors.count { |s| s.tier_priority == 0 },
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
      # Public - get hole sponsors indexed by course and hole number
      def by_hole
        hole_sponsors = @tournament.sponsors.active.hole_sponsors

        by_hole = @tournament.course_configs.each_with_object({}) do |course, hash|
          holes = (1..course['hole_count'].to_i).each_with_object({}) do |hole, course_hash|
            sponsor = hole_sponsors.find { |s| s.course_key == course['key'] && s.hole_number == hole }
            course_hash[hole] = sponsor_response(sponsor) if sponsor
          end
          hash[course['key']] = holes if holes.any?
        end

        render json: { by_hole: by_hole }
      end

      # POST /api/v1/tournaments/:tournament_id/sponsors
      # Admin - create sponsor
      def create
        sponsor = @tournament.sponsors.build(sponsor_params)

        if sponsor.save
          sponsor.reload
          render json: { sponsor: sponsor_response(sponsor), message: 'Sponsor created' }, status: :created
        else
          render json: { error: sponsor.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/tournaments/:tournament_id/sponsors/:id
      # Admin - update sponsor
      def update
        if @sponsor.update(sponsor_params)
          @sponsor.reload
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

      # GET /api/v1/tournaments/:tournament_id/sponsors/:id/slots
      # Admin - get sponsor slots with player details
      def slots
        slots = @sponsor.sponsor_slots.order(:slot_number)
        render json: {
          slots: slots.map { |s|
            {
              id: s.id,
              slot_number: s.slot_number,
              player_name: s.player_name,
              player_email: s.player_email,
              player_phone: s.player_phone,
              confirmed_at: s.confirmed_at
            }
          }
        }
      end

      # PATCH /api/v1/tournaments/:tournament_id/sponsors/:id/slots/:slot_id
      # Admin - update a sponsor slot (admins bypass deadline)
      def update_slot
        slot = @sponsor.sponsor_slots.find(params[:slot_id])

        slot.update!(
          player_name: params[:player_name],
          player_email: params[:player_email],
          player_phone: params[:player_phone],
          confirmed_at: Time.current
        )

        begin
          SponsorSlotSyncer.new(@sponsor).sync_slot(slot)
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: "Slot saved but player roster sync failed: #{e.message}" }, status: :unprocessable_entity
          return
        end

        render json: {
          slot: {
            id: slot.id,
            slot_number: slot.slot_number,
            player_name: slot.player_name,
            player_email: slot.player_email,
            player_phone: slot.player_phone,
            confirmed_at: slot.confirmed_at
          }
        }
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
          :course_key, :hole_number, :position, :active, :login_email, :slot_count, :logo
        )
      end

      def sponsor_response(sponsor)
        logo = if sponsor.logo.attached?
                 Rails.application.routes.url_helpers.rails_blob_url(
                   sponsor.logo,
                   host: ENV.fetch('API_URL', request.base_url)
                 )
               else
                 sponsor.logo_url
               end

        {
          id: sponsor.id,
          name: sponsor.name,
          tier: sponsor.tier,
          tier_display: sponsor.tier_display,
          logo_url: logo,
          website_url: sponsor.website_url,
          description: sponsor.description,
          course_key: sponsor.course_key,
          course_name: sponsor.course_name,
          hole_number: sponsor.hole_number,
          position: sponsor.position,
          active: sponsor.active,
          major: sponsor.major?,
          display_label: sponsor.display_label,
          slot_count: sponsor.slot_count,
          login_email: sponsor.login_email,
          slots_filled: sponsor.sponsor_slots.where.not(player_name: [nil, '']).count
        }
      end
    end
  end
end
