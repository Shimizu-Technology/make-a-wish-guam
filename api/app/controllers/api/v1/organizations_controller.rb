# frozen_string_literal: true

module Api
  module V1
    class OrganizationsController < BaseController
      skip_before_action :authenticate_user!, only: [:show, :tournaments, :tournament]

      # GET /api/v1/organizations/:slug
      # Public endpoint - returns organization info
      def show
        organization = Organization.find_by_slug!(params[:slug])
        
        render json: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          description: organization.description,
          logo_url: organization.logo_url,
          primary_color: organization.primary_color,
          banner_url: organization.banner_url,
          contact_email: organization.contact_email,
          contact_phone: organization.contact_phone,
          website_url: organization.website_url,
          settings: organization.settings || {},
          tournament_count: organization.tournament_count
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Organization not found' }, status: :not_found
      end

      # GET /api/v1/organizations/:slug/tournaments
      # Public endpoint - returns organization's public tournaments
      def tournaments
        organization = Organization.find_by_slug!(params[:slug])
        loaded = organization.tournaments
                             .includes(:organization, :sponsors)
                             .where(public_listed: true)
                             .where(status: %w[open closed in_progress completed])
                             .order(event_date: :desc)
                             .to_a

        preload_tournament_stats(loaded) if loaded.any?

        render json: loaded, each_serializer: TournamentSerializer
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Organization not found' }, status: :not_found
      end

      # GET /api/v1/organizations/:slug/tournaments/:tournament_slug
      # Public endpoint - returns specific tournament with sponsors
      def tournament
        organization = Organization.find_by_slug!(params[:slug])
        tournament = organization.tournaments.where(public_listed: true).find_by!(slug: params[:tournament_slug])
        
        # Get active sponsors grouped by tier
        sponsors = tournament.sponsors.active.ordered.includes(logo_attachment: :blob).map do |s|
          logo = if s.logo.attached?
                   Rails.application.routes.url_helpers.rails_blob_url(
                     s.logo,
                     host: ENV.fetch('API_URL', request.base_url)
                   )
                 else
                   s.logo_url
                 end

          {
            id: s.id,
            name: s.name,
            tier: s.tier,
            tier_display: s.tier_display,
            logo_url: logo,
            website_url: s.website_url,
            description: s.description,
            hole_number: s.hole_number,
            major: s.major?
          }
        end

        # Render tournament with sponsors
        tournament_data = TournamentSerializer.new(tournament).as_json
        tournament_data[:sponsors] = sponsors
        
        render json: tournament_data
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Tournament not found' }, status: :not_found
      end

      # GET /api/v1/admin/organizations
      # Returns organizations the current user can access (single-org: MAW only)
      def index
        organizations = current_user.accessible_organizations.order(:name)
        render json: organizations.map { |org| organization_response(org) }
      end

      # PATCH /api/v1/admin/organizations/:slug
      # Admin endpoint - update organization settings
      def update
        organization = Organization.find_by_slug!(params[:slug])
        require_org_admin!(organization)
        return if performed?

        if organization.update(organization_params)
          render json: organization_response(organization)
        else
          render json: { errors: organization.errors.full_messages }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Organization not found' }, status: :not_found
      end

      # GET /api/v1/admin/organizations/:slug/tournaments
      # Admin/volunteer endpoint - returns all tournaments with stats
      def admin_tournaments
        organization = Organization.find_by_slug!(params[:slug])
        require_volunteer_or_admin!(organization)
        return if performed?

        loaded = organization.tournaments
                              .left_joins(:golfers)
                              .select(
                                "tournaments.*",
                                "SUM(CASE WHEN golfers.registration_status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count",
                                "SUM(CASE WHEN golfers.registration_status = 'confirmed' AND golfers.payment_status != 'paid' AND COALESCE(golfers.payment_type, '') != 'sponsor' THEN 1 ELSE 0 END) AS pending_count",
                                "SUM(CASE WHEN golfers.registration_status = 'confirmed' AND golfers.payment_status = 'paid' AND COALESCE(golfers.payment_type, '') != 'sponsor' THEN 1 ELSE 0 END) AS paying_count",
                                "(SELECT COALESCE(SUM(sponsors.slot_count), 0) / 2 FROM sponsors WHERE sponsors.tournament_id = tournaments.id AND sponsors.active = true) AS sponsor_teams_count"
                              )
                              .group("tournaments.id")
                              .order(event_date: :desc)
                              .to_a

        tournament_data = loaded.map do |t|
          confirmed_count = t.read_attribute(:confirmed_count).to_i
          pending_count = t.read_attribute(:pending_count).to_i
          paying_count = t.read_attribute(:paying_count).to_i
          sponsor_teams = t.read_attribute(:sponsor_teams_count).to_i

          {
            id: t.id,
            name: t.name,
            slug: t.slug,
            date: t.event_date,
            status: t.status,
            registration_count: confirmed_count,
            pending_count: pending_count,
            capacity: t.max_capacity,
            revenue: paying_count * (t.entry_fee || 0),
            sponsor_reserved_teams: sponsor_teams,
            walkin_fee: t.walkin_fee,
            walkin_swipe_simple_url: t.walkin_swipe_simple_url,
            entry_fee_display: t.entry_fee_display
          }
        end

        total_revenue = loaded.sum { |t| t.read_attribute(:paying_count).to_i * (t.entry_fee || 0) }
        total_registrations = loaded.sum { |t| t.read_attribute(:confirmed_count).to_i }
        active_count = loaded.count { |t| %w[open in_progress].include?(t.status) }

        stats = {
          total_tournaments: loaded.size,
          active_tournaments: active_count,
          total_registrations: total_registrations,
          total_revenue: total_revenue
        }

        render json: { tournaments: tournament_data, stats: stats }
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Organization not found' }, status: :not_found
      end

      # GET /api/v1/admin/organizations/:slug/tournaments/:tournament_slug
      # Admin/volunteer endpoint - returns tournament details with all golfers
      def admin_tournament
        organization = Organization.find_by_slug!(params[:slug])
        require_volunteer_or_admin!(organization)
        return if performed?

        tournament = organization.tournaments.includes(:organization, :sponsors).find_by!(slug: params[:tournament_slug])
        golfers = tournament.golfers.includes(:group, :sponsor).order(created_at: :desc).to_a

        hole_labels = bulk_hole_position_labels(tournament.id, golfers)

        counts_by_registration = golfers.group_by(&:registration_status).transform_values(&:count)

        active_golfers = golfers.reject { |g| g.registration_status == 'cancelled' }
        confirmed_golfers = active_golfers.select { |g| g.registration_status == 'confirmed' }
        confirmed_and_paid = confirmed_golfers.count { |g| g.payment_status == 'paid' || g.payment_type == 'sponsor' }
        confirmed_pending = confirmed_golfers.count { |g| g.payment_status != 'paid' && g.payment_type != 'sponsor' }
        confirmed_paid = confirmed_golfers.count { |g| g.payment_status == 'paid' }

        confirmed_count = counts_by_registration.fetch('confirmed', 0)
        sponsor_confirmed = confirmed_golfers.count { |g| g.payment_type == 'sponsor' }
        public_confirmed = confirmed_count - sponsor_confirmed

        # Pre-set stats so TournamentSerializer doesn't fire additional queries
        tournament.instance_variable_set(:@golfer_stats, {
          confirmed: confirmed_count,
          public_confirmed: public_confirmed,
          sponsor_confirmed: sponsor_confirmed,
          paid: confirmed_paid,
          pending_payment: confirmed_pending,
          waitlist: counts_by_registration.fetch('waitlist', 0),
          checked_in: golfers.count { |g| g.checked_in_at.present? }
        })

        stats = {
          total_registrations: active_golfers.count,
          registered: confirmed_count,
          confirmed: confirmed_and_paid,
          pending_payment: confirmed_pending,
          public_confirmed: public_confirmed,
          sponsor_confirmed: sponsor_confirmed,
          waitlisted: counts_by_registration.fetch('waitlist', 0),
          cancelled: counts_by_registration.fetch('cancelled', 0),
          paid: confirmed_paid,
          checked_in: golfers.count { |g| g.checked_in_at.present? },
          revenue: golfers.count { |g| g.payment_status == 'paid' && g.payment_type != 'sponsor' } * (tournament.entry_fee || 0),
          max_capacity: tournament.max_capacity,
          sponsor_reserved_teams: tournament.sponsor_reserved_teams,
          public_capacity: tournament.public_capacity,
          capacity_remaining: tournament.capacity_remaining,
          public_capacity_remaining: tournament.public_capacity_remaining,
          at_capacity: tournament.at_capacity?,
          public_at_capacity: tournament.public_at_capacity?
        }

        render json: {
          tournament: TournamentSerializer.new(tournament).as_json,
          golfers: golfers.map { |g|
            g.as_json(
              only: [:id, :name, :email, :phone, :company, :registration_status,
                     :payment_status, :payment_method, :payment_type, :checked_in_at, :created_at,
                     :paid_at, :payment_verified_by_name, :payment_verified_at,
                     :checked_in_by_name, :payment_notes,
                     :partner_name, :partner_email, :partner_phone,
                     :team_name, :team_category, :registration_source, :group_id,
                     :sponsor_id, :sponsor_name, :notes]
            ).merge(
              "hole_position_label" => hole_labels[g.id],
              "starting_hole_description" => g.group&.starting_hole_description,
              "sponsor_display_name" => g.sponsor_name.presence || g.sponsor&.name
            )
          },
          stats: stats
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Tournament not found' }, status: :not_found
      end

      # POST /api/v1/admin/organizations/:slug/tournaments
      # Create a new tournament for the organization
      def create_tournament
        organization = Organization.find_by_slug!(params[:slug])
        require_org_admin!(organization)
        return if performed?

        attrs = tournament_params.to_h
        if attrs.key?('course_configs')
          courses = Array(attrs.delete('course_configs')).map(&:to_h)
          attrs['config'] = (attrs['config'] || {}).merge('course_configs' => courses)
          attrs['total_holes'] = courses.sum { |course| course['hole_count'].to_i }
        end

        tournament = organization.tournaments.build(attrs)
        
        # Generate slug if not provided
        if tournament.slug.blank?
          base_slug = "#{tournament.name.parameterize}-#{tournament.year}"
          tournament.slug = base_slug
          
          # Ensure uniqueness
          counter = 1
          while organization.tournaments.exists?(slug: tournament.slug)
            tournament.slug = "#{base_slug}-#{counter}"
            counter += 1
          end
        end

        if tournament.save
          render json: { 
            tournament: tournament.as_json(
              only: [:id, :name, :slug, :year, :edition, :status, :event_date, 
                     :location_name, :entry_fee, :max_capacity]
            ),
            message: 'Tournament created successfully'
          }, status: :created
        else
          render json: { error: tournament.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Organization not found' }, status: :not_found
      end

      # POST /api/v1/admin/organizations/:slug/tournaments/:tournament_slug/golfers
      # Admin endpoint - create a golfer (manual registration)
      def create_golfer
        organization = Organization.find_by_slug!(params[:slug])
        require_org_admin!(organization)
        return if performed?

        tournament = organization.tournaments.find_by!(slug: params[:tournament_slug])
        golfer = tournament.golfers.build(golfer_params)

        if golfer.save
          render json: {
            golfer: golfer.as_json(
              only: [:id, :name, :email, :phone, :company, :registration_status,
                     :payment_status, :payment_method, :notes, :created_at]
            ),
            message: 'Golfer added successfully'
          }, status: :created
        else
          render json: { error: golfer.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Tournament not found' }, status: :not_found
      end

      # PATCH /api/v1/admin/organizations/:slug/tournaments/:tournament_slug/golfers/:golfer_id
      # Admin endpoint - update a golfer
      def update_golfer
        organization = Organization.find_by_slug!(params[:slug])
        require_org_admin!(organization)
        return if performed?

        tournament = organization.tournaments.find_by!(slug: params[:tournament_slug])
        golfer = tournament.golfers.find(params[:golfer_id])

        if golfer.update(golfer_params)
          render json: {
            golfer: golfer_response(golfer),
            message: 'Golfer updated successfully'
          }
        else
          render json: { error: golfer.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Golfer not found' }, status: :not_found
      end

      # POST /api/v1/admin/organizations/:slug/tournaments/:tournament_slug/golfers/:golfer_id/cancel
      # Admin endpoint - cancel a golfer's registration
      def cancel_golfer
        organization = Organization.find_by_slug!(params[:slug])
        require_org_admin!(organization)
        return if performed?

        tournament = organization.tournaments.find_by!(slug: params[:tournament_slug])
        golfer = tournament.golfers.find(params[:golfer_id])

        if golfer.registration_status == 'cancelled'
          render json: { error: 'Registration already cancelled' }, status: :unprocessable_entity
          return
        end

        golfer.update!(registration_status: 'cancelled')
        
        render json: {
          golfer: golfer_response(golfer),
          message: 'Registration cancelled successfully'
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Golfer not found' }, status: :not_found
      end

      # POST /api/v1/admin/organizations/:slug/tournaments/:tournament_slug/golfers/:golfer_id/refund
      # Admin endpoint - process refund (Stripe for online payments, manual for cash/check)
      def refund_golfer
        organization = Organization.find_by_slug!(params[:slug])
        require_org_admin!(organization)
        return if performed?

        tournament = organization.tournaments.find_by!(slug: params[:tournament_slug])
        golfer = tournament.golfers.find(params[:golfer_id])

        reason = params[:reason]

        if golfer.payment_type == 'stripe'
          if golfer.refunded?
            render json: { error: 'Already refunded' }, status: :unprocessable_entity
            return
          end

          if golfer.payment_status != 'paid'
            render json: { error: 'Cannot refund unpaid registration' }, status: :unprocessable_entity
            return
          end

          unless golfer.can_refund?
            render json: { error: 'Cannot process Stripe refund for this golfer' }, status: :unprocessable_entity
            return
          end

          old_group = golfer.group

          # Process refund first; only detach group after successful refund
          stripe_refund = golfer.process_refund!(admin: current_admin, reason: reason)
          golfer.update!(group_id: nil) if old_group.present?

          begin
            ActivityLog.log(
              admin: current_admin,
              action: 'golfer_refunded',
              target: golfer,
              details: "Refunded #{golfer.name} - $#{'%.2f' % (stripe_refund.amount / 100.0)}",
              metadata: { reason: reason, refund_id: stripe_refund.id, amount_cents: stripe_refund.amount }
            )
          rescue StandardError => e
            Rails.logger.error("Failed to log refund activity: #{e.message}")
          end

          begin
            ActionCable.server.broadcast("golfers_channel_#{golfer.tournament_id}", {
              action: 'updated',
              golfer: GolferSerializer.new(golfer).as_json
            })
          rescue StandardError => e
            Rails.logger.error("Failed to broadcast golfer update: #{e.message}")
          end

          render json: {
            golfer: golfer_response(golfer),
            refund: {
              id: stripe_refund.id,
              amount: stripe_refund.amount,
              status: stripe_refund.status
            },
            message: 'Refund recorded successfully'
          }
        else
          response_payload = nil

          golfer.with_lock do
            if golfer.refunded?
              render json: { error: 'Already refunded' }, status: :unprocessable_entity
              return
            end

            if golfer.payment_status != 'paid'
              render json: { error: 'Cannot refund unpaid registration' }, status: :unprocessable_entity
              return
            end

            old_group = golfer.group
            golfer.update!(group_id: nil) if old_group.present?

            refund_amount = params[:refund_amount_cents] || golfer.payment_amount_cents || golfer.tournament&.entry_fee

            golfer.update!(
              registration_status: 'cancelled',
              payment_status: 'refunded',
              refund_amount_cents: refund_amount,
              refund_reason: reason,
              refunded_at: Time.current,
              refunded_by: current_admin
            )

            response_payload = {
              golfer: golfer_response(golfer),
              message: 'Refund recorded successfully'
            }
          end

          begin
            GolferMailer.refund_confirmation_email(golfer).deliver_later
          rescue StandardError => e
            Rails.logger.error("Failed to send refund email: #{e.message}")
          end

          begin
            ActivityLog.log(
              admin: current_admin,
              action: 'golfer_refunded',
              target: golfer,
              details: "Marked #{golfer.name} as refunded (manual) - $#{'%.2f' % (golfer.refund_amount_cents.to_i / 100.0)}",
              metadata: { reason: reason, amount_cents: golfer.refund_amount_cents }
            )
          rescue StandardError => e
            Rails.logger.error("Failed to log manual refund activity: #{e.message}")
          end

          begin
            ActionCable.server.broadcast("golfers_channel_#{golfer.tournament_id}", {
              action: 'updated',
              golfer: GolferSerializer.new(golfer).as_json
            })
          rescue StandardError => e
            Rails.logger.error("Failed to broadcast golfer update: #{e.message}")
          end

          render json: response_payload
        end
      rescue Stripe::StripeError => e
        Rails.logger.error("Stripe refund error: #{e.message}")
        render json: { error: "Stripe refund failed: #{e.message}" }, status: :unprocessable_entity
      rescue RuntimeError => e
        Rails.logger.error("Refund runtime error: #{e.message}")
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Golfer not found' }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.error("Refund database error: #{e.message}")
        render json: { error: "Failed to update golfer record: #{e.message}" }, status: :unprocessable_entity
      end

      # GET /api/v1/admin/organizations/:slug/members
      def members
        org = Organization.find_by!(slug: params[:slug])
        require_org_admin!(org)
        return if performed?

        memberships = org.organization_memberships.includes(:user).order(created_at: :asc)

        render json: {
          members: memberships.map { |m| member_response(m) }
        }
      end

      # POST /api/v1/admin/organizations/:slug/members
      def add_member
        org = Organization.find_by!(slug: params[:slug])
        require_org_admin!(org)
        return if performed?

        email = params[:email]&.strip&.downcase

        unless email.present?
          return render json: { error: "Email is required" }, status: :unprocessable_entity
        end

        user = User.where('LOWER(email) = LOWER(?)', email).first

        unless user
          user = User.create!(
            email: email,
            clerk_id: "pending_#{Digest::SHA256.hexdigest(email)[0..23]}",
            role: 'org_admin'
          )
        end

        existing = org.organization_memberships.find_by(user: user)
        if existing
          return render json: { error: "This user is already a member of this organization." }, status: :unprocessable_entity
        end

        role = params[:role].presence || 'admin'
        unless OrganizationMembership::ROLES.include?(role)
          return render json: { error: "Invalid role: #{role}" }, status: :unprocessable_entity
        end
        membership = org.organization_memberships.create!(user: user, role: role)

        SendUserInviteEmailJob.perform_later(user.id, current_user&.id, role)

        render json: {
          member: member_response(membership),
          invitation_sent: true
        }, status: :created
      end

      # POST /api/v1/admin/organizations/:slug/members/:member_id/resend_invite
      def resend_invite
        org = Organization.find_by!(slug: params[:slug])
        require_org_admin!(org)
        return if performed?

        membership = org.organization_memberships.find(params[:member_id])
        user = membership.user

        unless user.clerk_id&.start_with?('pending_')
          return render json: { error: "This user has already accepted their invitation." }, status: :unprocessable_entity
        end

        SendUserInviteEmailJob.perform_later(user.id, current_user&.id)

        render json: { message: "Invitation email queued for #{user.email}" }
      end

      # PATCH /api/v1/admin/organizations/:slug/members/:member_id
      def update_member
        org = Organization.find_by!(slug: params[:slug])
        require_org_admin!(org)
        return if performed?

        membership = org.organization_memberships.find(params[:member_id])

        unless OrganizationMembership::ROLES.include?(params[:role])
          return render json: { error: "Invalid role" }, status: :unprocessable_entity
        end

        # Don't let the last admin demote themselves
        if membership.admin? && params[:role] != 'admin' && org.organization_memberships.admins.count <= 1
          return render json: { error: "Cannot demote the last admin" }, status: :unprocessable_entity
        end

        membership.update!(role: params[:role])
        render json: { member: member_response(membership) }
      end

      # DELETE /api/v1/admin/organizations/:slug/members/:member_id
      def remove_member
        org = Organization.find_by!(slug: params[:slug])
        require_org_admin!(org)
        return if performed?

        membership = org.organization_memberships.find(params[:member_id])

        # Don't let the last admin remove themselves
        if membership.admin? && org.organization_memberships.admins.count <= 1
          return render json: { error: "Cannot remove the last admin" }, status: :unprocessable_entity
        end

        membership.destroy!
        render json: { success: true }
      end

      private

      # Compute hole position labels for all golfers in one query instead of 2 per golfer
      def bulk_hole_position_labels(tournament_id, golfers)
        groups_by_id = {}
        golfers.each do |g|
          groups_by_id[g.group_id] = g.group if g.group
        end
        return {} if groups_by_id.empty?

        tournament = Tournament.find(tournament_id)

        groups_by_hole = Group.where(tournament_id: tournament_id)
                              .where.not(hole_number: nil)
                              .order(:group_number)
                              .group_by { |group| [group.starting_course_key, group.hole_number] }

        golfers.each_with_object({}) do |g, labels|
          grp = groups_by_id[g.group_id]
          next labels[g.id] = nil unless grp
          next labels[g.id] = "Unassigned" unless grp.assigned_start?

          hole_groups = groups_by_hole[[grp.starting_course_key, grp.hole_number]] || []
          idx = hole_groups.index { |hg| hg.id == grp.id }
          letter = idx ? ('A'..'Z').to_a[idx] || 'X' : 'X'
          prefix = tournament.starting_position_prefix(grp.starting_course_key)
          labels[g.id] = [prefix, "#{grp.hole_number}#{letter}"].compact.join(' ')
        end
      end

      def member_response(membership)
        user = membership.user
        {
          id: membership.id,
          user_id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: membership.role,
          invitation_pending: user.clerk_id&.start_with?('pending_') || false,
          created_at: membership.created_at
        }
      end

      def golfer_response(golfer)
        golfer.as_json(
          only: [:id, :name, :email, :phone, :company, :registration_status,
                 :payment_status, :payment_method, :payment_type, :notes, 
                 :checked_in_at, :created_at, :updated_at]
        )
      end

      def golfer_params
        params.require(:golfer).permit(
          :name, :email, :phone, :mobile, :company, :address,
          :payment_type, :payment_status, :payment_method,
          :registration_status, :registration_source, :notes, :waiver_accepted_at,
          :is_team_captain,
          :partner_name, :partner_email, :partner_phone, :team_category
        )
      end

      def tournament_params
        params.require(:tournament).permit(
          :name, :year, :edition, :status, :slug,
          :event_date, :registration_time, :start_time, :check_in_time,
          :location_name, :location_address,
          :tournament_format, :scoring_type, :team_size, :shotgun_start,
          :max_capacity, :reserved_slots, :waitlist_enabled, :waitlist_max,
          :entry_fee, :early_bird_fee, :early_bird_deadline,
          :allow_cash, :allow_check, :allow_card, :checks_payable_to, :payment_instructions,
          :registration_deadline,
          :contact_name, :contact_phone, :fee_includes,
          :walkin_fee, :walkin_registration_open,
          course_configs: [:key, :name, :hole_count]
        )
      end

      def organization_params
        params.require(:organization).permit(
          :name, :slug, :description, :logo_url, :primary_color,
          :banner_url, :contact_email, :contact_phone, :website_url,
          settings: {}
        )
      end

      def organization_response(org)
        {
          id: org.id,
          name: org.name,
          slug: org.slug,
          description: org.description,
          logo_url: org.logo_url,
          primary_color: org.primary_color,
          banner_url: org.banner_url,
          contact_email: org.contact_email,
          contact_phone: org.contact_phone,
          website_url: org.website_url,
          settings: org.settings || {},
          subscription_status: org.subscription_status,
          tournament_count: org.tournament_count,
          admin_count: org.admin_count,
          created_at: org.created_at,
          updated_at: org.updated_at
        }
      end
    end
  end
end
