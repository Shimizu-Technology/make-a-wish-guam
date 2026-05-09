# frozen_string_literal: true

require "mini_magick"
require "tempfile"

module Api
  module V1
    class RaffleController < BaseController
      include ImageUploadValidation

      MAX_PRIZE_IMAGE_SIZE = 5.megabytes

      skip_before_action :authenticate_user!, only: [:prizes, :tickets, :board]
      before_action :set_tournament
      before_action :authorize_tournament_admin!, only: [
        :create_prize, :update_prize, :destroy_prize,
        :draw, :draw_all, :reset_prize, :claim_prize,
        :mark_ticket_paid, :void_ticket, :destroy_ticket,
        :sync_tickets, :resend_winner_notification
      ]
      before_action :authorize_volunteer_or_admin!, only: [
        :admin_tickets, :create_tickets, :sell_tickets, :resend_ticket_confirmation
      ]

      # ===========================================
      # PUBLIC ENDPOINTS
      # ===========================================

      # GET /api/v1/tournaments/:tournament_id/raffle/prizes
      # Public - get all prizes for raffle board
      def prizes
        prizes = raffle_prizes_for_display

        render json: {
          tournament: {
            id: @tournament.id,
            name: @tournament.name,
            raffle_enabled: @tournament.raffle_enabled,
            raffle_ticket_price_cents: @tournament.raffle_ticket_price_cents,
            raffle_draw_time: @tournament.raffle_draw_time
          },
          prizes: prizes.map { |p| prize_response(p, include_winner: p.won?) }
        }
      end

      # GET /api/v1/tournaments/:tournament_id/raffle/board
      # Public - get raffle board display data
      def board
        prizes = raffle_prizes_for_display
        
        render json: {
          tournament: {
            id: @tournament.id,
            name: @tournament.name,
            raffle_enabled: @tournament.raffle_enabled,
            raffle_draw_time: @tournament.raffle_draw_time,
            raffle_description: @tournament.raffle_description
          },
          prizes: prizes.map { |p| prize_response(p, include_winner: p.won?) },
          stats: {
            total_prizes: prizes.count,
            prizes_won: prizes.won.count,
            prizes_remaining: prizes.available.count,
            total_tickets_sold: @tournament.raffle_tickets.paid.with_eligible_participant.count
          },
          last_updated: Time.current.iso8601
        }
      end

      # GET /api/v1/tournaments/:tournament_id/raffle/tickets
      # Public - look up tickets by email, phone, or ticket number
      def tickets
        query = params[:query].presence || params[:email].presence
        return render json: { error: 'Search query required' }, status: :bad_request unless query.present?

        q = query.strip
        base = @tournament.raffle_tickets.paid.with_eligible_participant

        tickets = base.where(purchaser_email: q.downcase)
                      .or(base.where(purchaser_phone: q))
                      .or(base.where("LOWER(ticket_number) = ?", q.downcase))

        if tickets.empty?
          phone_digits = q.gsub(/\D/, '')
          if phone_digits.length >= 7
            normalized = phone_digits.length == 10 ? "+1#{phone_digits}" : "+#{phone_digits}"
            tickets = base.where(purchaser_phone: normalized)
          end
        end

        render json: {
          query: q,
          ticket_count: tickets.count,
          tickets: tickets.map { |t| ticket_response(t) }
        }
      end

      # ===========================================
      # ADMIN ENDPOINTS - Prizes
      # ===========================================

      # POST /api/v1/tournaments/:tournament_id/raffle/prizes
      # Admin - create a prize
      def create_prize
        prize = @tournament.raffle_prizes.build(prize_attributes)
        prize.image_url = nil if remove_image_requested?
        saved = false

        RafflePrize.transaction do
          saved = prize.save
          raise ActiveRecord::Rollback unless saved

          saved = attach_uploaded_image(prize)
          raise ActiveRecord::Rollback unless saved
        end

        if saved
          ActivityLog.log(
            admin: current_user, action: 'raffle_prize_created', target: prize,
            details: "Created raffle prize #{prize.name}",
            metadata: {
              prize_id: prize.id,
              tier: prize.tier,
              value_cents: prize.value_cents,
              image_attached: prize.image.attached?
            },
            tournament: @tournament
          )
          render json: { prize: prize_response(prize), message: 'Prize created' }, status: :created
        else
          render json: { error: prize.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/tournaments/:tournament_id/raffle/prizes/:id
      # Admin - update a prize
      def update_prize
        prize = @tournament.raffle_prizes.find(params[:id])
        remove_image = remove_image_requested?
        before_snapshot = prize_audit_snapshot(prize)
        image_action = prize_image_audit_action(prize, remove_image)
        blob_to_purge = remove_image && prize.image.attached? ? prize.image.blob : nil
        saved = false

        RafflePrize.transaction do
          prize.assign_attributes(prize_attributes)
          prize.image_url = nil if remove_image
          saved = prize.save
          raise ActiveRecord::Rollback unless saved

          prize.image.detach if remove_image && prize.image.attached?
          saved = remove_image ? true : attach_uploaded_image(prize)
          raise ActiveRecord::Rollback unless saved
        end

        if saved
          blob_to_purge&.purge_later
          prize.reload
          log_raffle_prize_updated(prize, before_snapshot: before_snapshot, image_action: image_action)
          render json: { prize: prize_response(prize), message: 'Prize updated' }
        else
          render json: { error: prize.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/tournaments/:tournament_id/raffle/prizes/:id
      # Admin - delete a prize
      def destroy_prize
        prize = @tournament.raffle_prizes.find(params[:id])

        if prize.won?
          render json: { error: 'Cannot delete a prize that has been won' }, status: :unprocessable_entity
        else
          prize_snapshot = prize_audit_snapshot(prize)
          prize.destroy
          ActivityLog.log(
            admin: current_user, action: 'raffle_prize_deleted', target: prize,
            details: "Deleted raffle prize #{prize_snapshot[:name]}",
            metadata: prize_snapshot.merge(prize_id: prize.id),
            tournament: @tournament
          )
          render json: { message: 'Prize deleted' }
        end
      end

      # ===========================================
      # ADMIN ENDPOINTS - Drawing
      # ===========================================

      # POST /api/v1/tournaments/:tournament_id/raffle/prizes/:id/draw
      # Admin - draw a winner for a specific prize
      def draw
        prize = @tournament.raffle_prizes.find(params[:id])

        if prize.won?
          render json: { error: 'Prize already won' }, status: :unprocessable_entity
          return
        end

        if prize.draw_winner!
          ActivityLog.log(
            admin: current_user, action: 'raffle_prize_drawn', target: prize,
            details: "Drew winner #{prize.winner_name} (ticket #{prize.winning_ticket&.display_number}) for #{prize.name}",
            metadata: { winner_name: prize.winner_name, ticket_number: prize.winning_ticket&.ticket_number },
            tournament: @tournament
          )
          render json: {
            prize: prize_response(prize, include_winner: true),
            message: "#{prize.winner_name} won #{prize.name}!"
          }
        else
          render json: { error: 'No eligible tickets for drawing' }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/draw_all
      # Admin - draw winners for all remaining prizes
      def draw_all
        available_prizes = @tournament.raffle_prizes.available.ordered
        
        if available_prizes.empty?
          render json: { error: 'No prizes remaining to draw' }, status: :unprocessable_entity
          return
        end

        results = []
        available_prizes.each do |prize|
          if prize.draw_winner!
            results << { prize: prize.name, winner: prize.winner_name, success: true }
          else
            results << { prize: prize.name, winner: nil, success: false, error: 'No eligible tickets' }
          end
        end

        won_count = results.count { |r| r[:success] }
        ActivityLog.log(
          admin: current_user, action: 'raffle_draw_all', target: @tournament,
          details: "Drew #{won_count} winners from #{results.size} remaining prizes",
          metadata: { results: results },
          tournament: @tournament
        )
        render json: {
          results: results,
          message: "Drew #{won_count} winners"
        }
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/prizes/:id/reset
      # Admin - reset a prize (undo draw)
      def reset_prize
        prize = @tournament.raffle_prizes.find(params[:id])
        previous_winner = prize.winner_name

        if prize.reset!
          ActivityLog.log(
            admin: current_user, action: 'raffle_prize_reset', target: prize,
            details: "Reset prize #{prize.name} (previous winner: #{previous_winner})",
            metadata: { previous_winner: previous_winner },
            tournament: @tournament
          )
          render json: { prize: prize_response(prize), message: 'Prize reset' }
        else
          render json: { error: 'Cannot reset prize' }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/prizes/:id/claim
      # Admin - mark prize as claimed
      def claim_prize
        prize = @tournament.raffle_prizes.find(params[:id])

        if prize.claim!
          ActivityLog.log(
            admin: current_user, action: 'raffle_prize_claimed', target: prize,
            details: "Marked #{prize.name} as claimed by #{prize.winner_name}",
            tournament: @tournament
          )
          render json: { prize: prize_response(prize), message: 'Prize marked as claimed' }
        else
          render json: { error: 'Cannot claim prize' }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/prizes/:id/resend_notification
      # Admin - resend winner notification email/SMS
      def resend_winner_notification
        prize = @tournament.raffle_prizes.find(params[:id])

        unless prize.won?
          return render json: { error: 'Prize has not been won yet' }, status: :unprocessable_entity
        end

        delivery = {
          email: skipped_delivery_result('No winner email available'),
          sms: skipped_delivery_result('No winner phone available')
        }

        if prize.winner_email.present?
          begin
            result = RaffleMailer.winner_email(prize)
            delivery[:email] = normalize_delivery_result(result)
            log_delivery_failure("Resend winner email failed: #{delivery[:email][:error]}", delivery[:email])
          rescue => e
            Rails.logger.error "Resend winner email failed: #{e.message}"
            delivery[:email] = failed_delivery_result(e.message)
          end
        end

        winner_phone = prize.winner_phone.presence || prize.winning_ticket&.purchaser_phone
        if winner_phone.present?
          begin
            result = RaffleSmsService.winner_notification(raffle_prize: prize)
            delivery[:sms] = normalize_delivery_result(result)
            log_delivery_failure("Resend winner SMS failed: #{delivery[:sms][:error]}", delivery[:sms])
          rescue => e
            Rails.logger.error "Resend winner SMS failed: #{e.message}"
            delivery[:sms] = failed_delivery_result(e.message)
          end
        end

        channels = delivery_success_channels(delivery)

        if channels.any?
          ActivityLog.log(
            admin: current_user, action: 'raffle_winner_notification_resent', target: prize,
            details: "Resent winner notification for #{prize.name} to #{prize.winner_name} via #{channels.join(' and ')}",
            metadata: { channels: channels, winner_name: prize.winner_name, delivery: delivery },
            tournament: @tournament
          )
          render json: { message: "Notification resent via #{channels.join(' and ')}", delivery: delivery }
        else
          render json: { error: 'No contact info available for this winner or delivery failed', delivery: delivery }, status: :unprocessable_entity
        end
      end

      # ===========================================
      # ADMIN ENDPOINTS - Tickets
      # ===========================================

      # GET /api/v1/tournaments/:tournament_id/raffle/admin/tickets
      # Admin - list all tickets with search, filter, pagination
      def admin_tickets
        tickets = @tournament.raffle_tickets.includes(:golfer, :raffle_prize, :sold_by_user).recent

        # Filter by payment status
        tickets = tickets.where(payment_status: params[:status]) if params[:status].present?

        # Filter by type: "purchased" or "complimentary"
        case params[:type]
        when 'purchased'
          tickets = tickets.where('price_cents > 0').where.not(payment_status: 'voided')
        when 'complimentary'
          tickets = tickets.where(price_cents: [0, nil]).where.not(payment_status: 'voided')
        when 'winners'
          tickets = tickets.where(is_winner: true)
        when 'voided'
          tickets = tickets.where(payment_status: 'voided')
        end

        # Search by ticket number, name, email, or phone
        if params[:search].present?
          q = "%#{params[:search].downcase}%"
          tickets = tickets.where(
            "LOWER(ticket_number) LIKE ? OR LOWER(purchaser_name) LIKE ? OR LOWER(purchaser_email) LIKE ? OR purchaser_phone LIKE ?",
            q, q, q, "%#{params[:search]}%"
          )
        end

        # Compute all stats in a single query instead of 8 separate COUNT queries
        stat_row = @tournament.raffle_tickets.pick(
          Arel.sql("COUNT(*) FILTER (WHERE payment_status != 'voided')"),
          Arel.sql("COUNT(*) FILTER (WHERE payment_status = 'paid')"),
          Arel.sql("COUNT(*) FILTER (WHERE payment_status = 'pending')"),
          Arel.sql("COUNT(*) FILTER (WHERE is_winner = true AND payment_status != 'voided')"),
          Arel.sql("COUNT(*) FILTER (WHERE payment_status = 'voided')"),
          Arel.sql("COUNT(*) FILTER (WHERE payment_status != 'voided' AND COALESCE(price_cents, 0) = 0)"),
          Arel.sql("COUNT(*) FILTER (WHERE payment_status = 'paid' AND price_cents > 0)"),
          Arel.sql("COALESCE(SUM(price_cents) FILTER (WHERE payment_status = 'paid' AND price_cents > 0), 0)")
        )

        total_filtered = tickets.count

        page = [params[:page].to_i, 1].max
        per_page = [[params[:per_page].to_i, 1].max, 200].min
        per_page = 50 if params[:per_page].blank?
        paginated = tickets.offset((page - 1) * per_page).limit(per_page)

        render json: {
          tickets: paginated.map { |t| ticket_response(t, admin: true) },
          pagination: {
            page: page,
            per_page: per_page,
            total: total_filtered,
            total_pages: (total_filtered.to_f / per_page).ceil
          },
          stats: {
            total: stat_row[0].to_i,
            paid: stat_row[1].to_i,
            pending: stat_row[2].to_i,
            winners: stat_row[3].to_i,
            voided: stat_row[4].to_i,
            complimentary: stat_row[5].to_i,
            purchased: stat_row[6].to_i,
            additional_revenue_cents: stat_row[7].to_i
          }
        }
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/tickets
      # Admin - create tickets (manual sale)
      def create_tickets
        quantity = (params[:quantity] || 1).to_i

        tickets = []
        ActiveRecord::Base.transaction do
          @tournament.lock!
          quantity.times do
            ticket = @tournament.raffle_tickets.build(
              purchaser_name: params[:purchaser_name],
              purchaser_email: params[:purchaser_email]&.downcase,
              purchaser_phone: params[:purchaser_phone],
              golfer_id: params[:golfer_id],
              price_cents: @tournament.raffle_ticket_price_cents,
              payment_status: params[:mark_paid] ? 'paid' : 'pending',
              purchased_at: params[:mark_paid] ? Time.current : nil,
              sold_by_user_id: current_user.id
            )

            if ticket.save
              tickets << ticket
            else
              raise ActiveRecord::Rollback, ticket.errors.full_messages.join(', ')
            end
          end
        end

        if tickets.any?
          ActivityLog.log(
            admin: current_user, action: 'raffle_tickets_sold', target: @tournament,
            details: "Created #{tickets.count} ticket(s) for #{params[:purchaser_name]}",
            metadata: { quantity: tickets.count, purchaser_name: params[:purchaser_name] },
            tournament: @tournament
          )
          render json: {
            tickets: tickets.map { |t| ticket_response(t) },
            message: "#{tickets.count} ticket(s) created"
          }, status: :created
        else
          render json: { error: 'Failed to create tickets' }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/tickets/:id/mark_paid
      # Admin - mark ticket as paid
      def mark_ticket_paid
        ticket = @tournament.raffle_tickets.find(params[:id])
        previous_status = ticket.payment_status
        ticket.mark_paid!
        ActivityLog.log(
          admin: current_user, action: 'raffle_ticket_marked_paid', target: ticket,
          details: "Marked raffle ticket #{ticket.display_number} paid (#{ticket.purchaser_display})",
          metadata: {
            ticket_number: ticket.ticket_number,
            purchaser_name: ticket.purchaser_display,
            previous_status: previous_status
          },
          tournament: @tournament
        )

        render json: { ticket: ticket_response(ticket), message: 'Ticket marked as paid' }
      end

      # DELETE /api/v1/tournaments/:tournament_id/raffle/tickets/:id
      # Admin - delete/refund ticket
      def destroy_ticket
        ticket = @tournament.raffle_tickets.find(params[:id])

        if ticket.is_winner?
          render json: { error: 'Cannot delete a winning ticket' }, status: :unprocessable_entity
        else
          ticket_number = ticket.ticket_number
          display_number = ticket.display_number
          purchaser_name = ticket.purchaser_display
          payment_status = ticket.payment_status
          ticket.destroy
          ActivityLog.log(
            admin: current_user, action: 'raffle_ticket_deleted', target: ticket,
            details: "Deleted raffle ticket #{display_number} (#{purchaser_name})",
            metadata: {
              ticket_number: ticket_number,
              purchaser_name: purchaser_name,
              payment_status: payment_status
            },
            tournament: @tournament
          )
          render json: { message: 'Ticket deleted' }
        end
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/tickets/:id/void
      # Admin - void a ticket (keeps record but marks invalid)
      def void_ticket
        ticket = @tournament.raffle_tickets.find(params[:id])

        if ticket.is_winner?
          return render json: { error: 'Cannot void a winning ticket' }, status: :unprocessable_entity
        end

        if ticket.voided?
          return render json: { error: 'Ticket is already voided' }, status: :unprocessable_entity
        end

        ticket.void!(reason: params[:reason])
        ActivityLog.log(
          admin: current_user, action: 'raffle_ticket_voided', target: ticket,
          details: "Voided ticket #{ticket.display_number} (#{ticket.purchaser_display})#{params[:reason].present? ? " — #{params[:reason]}" : ''}",
          metadata: { ticket_number: ticket.ticket_number, reason: params[:reason] },
          tournament: @tournament
        )
        render json: { ticket: ticket_response(ticket, admin: true), message: "Ticket #{ticket.display_number} voided" }
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/sell
      # Volunteer/Admin - quick-sell raffle tickets using bundles or custom qty
      def sell_tickets
        quantity = params[:quantity].to_i
        price_cents = params[:price_cents].to_i
        buyer_name = params[:buyer_name]&.strip.presence
        buyer_email = params[:buyer_email]&.strip&.downcase.presence
        buyer_phone = params[:buyer_phone]&.strip.presence

        unless buyer_name.present?
          return render json: { error: 'Buyer name is required so raffle tickets can be identified during the drawing' }, status: :unprocessable_entity
        end

        unless buyer_email.present? || buyer_phone.present?
          return render json: { error: 'Email or phone number is required so the buyer can receive their ticket numbers' }, status: :unprocessable_entity
        end

        if quantity <= 0
          return render json: { error: 'Quantity must be positive' }, status: :unprocessable_entity
        end

        if price_cents <= 0
          return render json: { error: 'Price must be positive' }, status: :unprocessable_entity
        end

        base_cents = price_cents / quantity
        remainder = price_cents % quantity

        tickets = []
        ActiveRecord::Base.transaction do
          @tournament.lock!
          quantity.times do |i|
            ticket_price = base_cents + (i == quantity - 1 ? remainder : 0)
            tickets << @tournament.raffle_tickets.create!(
              purchaser_name: buyer_name,
              purchaser_email: buyer_email,
              purchaser_phone: buyer_phone,
              price_cents: ticket_price,
              payment_status: 'paid',
              purchased_at: Time.current,
              sold_by_user_id: current_user.id
            )
          end
        end

        delivery = send_purchase_notifications(tickets: tickets, buyer_email: buyer_email, buyer_phone: buyer_phone, buyer_name: buyer_name)

        ticket_numbers = tickets.map(&:ticket_number)
        ActivityLog.log(
          admin: current_user, action: 'raffle_tickets_sold', target: @tournament,
          details: "Sold #{tickets.size} ticket(s) for $#{(price_cents / 100.0).round(2)} to #{buyer_name}",
          metadata: { quantity: tickets.size, total_cents: price_cents, buyer_name: buyer_name,
                      buyer_email: buyer_email, buyer_phone: buyer_phone, ticket_numbers: ticket_numbers,
                      delivery: delivery },
          tournament: @tournament
        )

        render json: {
          tickets: tickets.map { |t| ticket_response(t) },
          sale_summary: {
            quantity: tickets.size,
            total_cents: price_cents,
            buyer_name: buyer_name,
            sold_by: current_user.name || current_user.email
          },
          delivery: delivery
        }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/tickets/:id/resend_confirmation
      # Volunteer/Admin - resend the full original sale's ticket numbers to the buyer
      def resend_ticket_confirmation
        ticket = @tournament.raffle_tickets.find(params[:id])

        if ticket.voided?
          return render json: { error: 'Cannot resend confirmation for a voided ticket' }, status: :unprocessable_entity
        end

        buyer_email = params.key?(:buyer_email) ? params[:buyer_email]&.strip&.downcase.presence : ticket.purchaser_email
        buyer_phone = params.key?(:buyer_phone) ? params[:buyer_phone]&.strip.presence : ticket.purchaser_phone
        buyer_name = params.key?(:buyer_name) ? params[:buyer_name].presence || ticket.purchaser_display : ticket.purchaser_display

        unless buyer_email.present? || buyer_phone.present?
          return render json: { error: 'This ticket has no email or phone number to resend to' }, status: :unprocessable_entity
        end

        tickets = ticket_confirmation_group(ticket)
        if tickets.empty?
          return render json: { error: 'No active paid tickets were found for this buyer group' }, status: :unprocessable_entity
        end

        delivery = send_purchase_notifications(
          tickets: tickets,
          buyer_email: buyer_email,
          buyer_phone: buyer_phone,
          buyer_name: buyer_name
        )

        unless delivery_success?(delivery[:email]) || delivery_success?(delivery[:sms])
          return render json: {
            error: 'Ticket confirmation could not be resent',
            delivery: delivery
          }, status: :bad_gateway
        end

        apply_ticket_contact_updates(
          tickets,
          buyer_name: buyer_name,
          buyer_email: buyer_email,
          buyer_phone: buyer_phone
        )

        ticket_numbers = tickets.map(&:display_number)
        ActivityLog.log(
          admin: current_user,
          action: 'raffle_ticket_confirmation_resent',
          target: ticket,
          details: "Resent #{tickets.size} raffle ticket number#{'s' unless tickets.size == 1} for #{buyer_name}",
          metadata: {
            buyer_name: buyer_name,
            buyer_email: buyer_email,
            buyer_phone: buyer_phone,
            ticket_numbers: ticket_numbers,
            source_ticket_id: ticket.id,
            delivery: delivery
          },
          tournament: @tournament
        )

        render json: {
          message: "Resent #{tickets.size} ticket number#{'s' unless tickets.size == 1}",
          ticket_count: tickets.size,
          ticket_numbers: ticket_numbers,
          buyer: {
            name: buyer_name,
            email: buyer_email,
            phone: buyer_phone
          },
          delivery: delivery,
          tickets: tickets.map { |t| ticket_response(t, admin: true) }
        }
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/sync_tickets
      # Admin - create missing complimentary raffle tickets for active registered golfers
      def sync_tickets
        eligible_golfers = @tournament.golfers
          .active
          .where(registration_status: %w[confirmed pending])

        before_count = @tournament.raffle_tickets.count
        voided_count = 0
        errors = []

        @tournament.raffle_tickets
          .joins(:golfer)
          .where(golfers: { registration_status: %w[cancelled waitlist] }, price_cents: [0, nil])
          .where.not(payment_status: "voided")
          .find_each do |ticket|
            ticket.void!(reason: "Registration not raffle eligible")
            voided_count += 1
          end

        eligible_golfers.find_each do |golfer|
          begin
            golfer.create_raffle_tickets!
          rescue => e
            errors << "#{golfer.name}: #{e.message}"
            Rails.logger.warn("sync_tickets: failed for golfer #{golfer.id}: #{e.message}")
          end
        end

        after_count = @tournament.raffle_tickets.count
        created_count = [after_count - before_count, 0].max

        ActivityLog.log(
          admin: current_user, action: 'raffle_tickets_synced', target: @tournament,
          details: "Synced registration tickets: #{created_count} created, #{voided_count} voided (#{after_count} total for #{eligible_golfers.count} teams)",
          metadata: { created: created_count, voided: voided_count, total: after_count, teams: eligible_golfers.count },
          tournament: @tournament
        )

        render json: {
          message: "Synced: #{created_count} ticket#{'s' unless created_count == 1} created, #{voided_count} voided (#{after_count} total for #{eligible_golfers.count} teams)",
          created: created_count,
          voided: voided_count,
          total_tickets: after_count,
          total_teams: eligible_golfers.count,
          errors: errors.presence
        }
      end

      private

      def set_tournament
        @tournament = Tournament.find(params[:tournament_id])
      end

      def authorize_tournament_admin!
        require_tournament_admin!(@tournament)
      end

      def authorize_volunteer_or_admin!
        require_volunteer_or_admin!(@tournament.organization)
      end

      def send_purchase_notifications(tickets:, buyer_email:, buyer_phone:, buyer_name:)
        delivery = {
          email: skipped_delivery_result('No email provided'),
          sms: skipped_delivery_result('No phone number provided')
        }

        if buyer_email.present?
          begin
            result = RaffleMailer.purchase_confirmation_email(
              tickets: tickets, buyer_email: buyer_email,
              buyer_name: buyer_name, tournament: @tournament
            )
            delivery[:email] = normalize_delivery_result(result)
            log_delivery_failure("Raffle purchase email failed: #{delivery[:email][:error]}", delivery[:email])
          rescue => e
            Rails.logger.warn("Raffle purchase email failed: #{e.message}")
            delivery[:email] = failed_delivery_result(e.message)
          end
        end

        if buyer_phone.present?
          begin
            result = RaffleSmsService.purchase_confirmation(
              tickets: tickets, buyer_phone: buyer_phone,
              buyer_name: buyer_name, tournament: @tournament
            )
            delivery[:sms] = normalize_delivery_result(result)
            log_delivery_failure("Raffle purchase SMS failed: #{delivery[:sms][:error]}", delivery[:sms])
          rescue => e
            Rails.logger.warn("Raffle purchase SMS failed: #{e.message}")
            delivery[:sms] = failed_delivery_result(e.message)
          end
        end

        delivery
      end

      def ticket_confirmation_group(ticket)
        ticket_numbers = sale_ticket_numbers_for(ticket)
        scope = @tournament.raffle_tickets.active.paid
        return [] unless scope.exists?(id: ticket.id)

        if ticket_numbers.present?
          return scope.where(ticket_number: ticket_numbers).order(:sequence_number).to_a
        end

        if ticket.golfer_id.present? && ticket.price_cents.to_i.zero?
          return scope.where(golfer_id: ticket.golfer_id, price_cents: [0, nil]).order(:sequence_number).to_a
        end

        if ticket.purchaser_name.blank? && ticket.purchaser_email.blank? && ticket.purchaser_phone.blank?
          return []
        end

        return [ticket] if ticket.purchased_at.blank?

        fallback = scope.where(
          purchaser_name: ticket.purchaser_name,
          purchaser_email: ticket.purchaser_email,
          purchaser_phone: ticket.purchaser_phone
        )

        fallback = fallback.where(purchased_at: (ticket.purchased_at - 2.minutes)..(ticket.purchased_at + 2.minutes))

        fallback.order(:sequence_number).to_a
      end

      def sale_ticket_numbers_for(ticket)
        ActivityLog
          .where(tournament: @tournament, action: 'raffle_tickets_sold')
          .where("metadata -> 'ticket_numbers' ? :ticket_number", ticket_number: ticket.ticket_number)
          .order(created_at: :desc)
          .each
          .lazy
          .map { |log| Array(log.metadata&.fetch('ticket_numbers', nil)) }
          .find { |numbers| numbers.include?(ticket.ticket_number) }
      end

      def apply_ticket_contact_updates(tickets, buyer_name:, buyer_email:, buyer_phone:)
        updates = {}
        updates[:purchaser_name] = buyer_name if params.key?(:buyer_name) && buyer_name.present?
        updates[:purchaser_email] = buyer_email if params.key?(:buyer_email) && buyer_email.present?
        updates[:purchaser_phone] = buyer_phone if params.key?(:buyer_phone) && buyer_phone.present?
        return if updates.empty?

        updates[:updated_at] = Time.current
        RaffleTicket.where(id: tickets.map(&:id)).update_all(updates)

        updates.except(:updated_at).each do |attribute, value|
          tickets.each { |ticket| ticket.public_send("#{attribute}=", value) }
        end
      end

      def normalize_delivery_result(result)
        return skipped_delivery_result('Delivery service not configured') if result.nil?
        return failed_delivery_result('No delivery result returned') if result.blank?

        normalized = result.with_indifferent_access
        {
          success: normalized[:success] == true,
          skipped: false,
          message_id: normalized[:message_id],
          data: normalized[:data],
          error: normalized[:error]
        }.compact
      end

      def skipped_delivery_result(reason)
        { success: false, skipped: true, error: reason }
      end

      def failed_delivery_result(error)
        { success: false, skipped: false, error: error.presence || 'Delivery failed' }
      end

      def delivery_success?(result)
        result.present? && result[:success] == true
      end

      def log_delivery_failure(message, result)
        return if result.blank? || delivery_success?(result) || result[:skipped] == true

        Rails.logger.error message
      end

      def delivery_success_channels(delivery)
        channels = []
        channels << 'email' if delivery_success?(delivery[:email])
        channels << 'SMS' if delivery_success?(delivery[:sms])
        channels
      end

      def prize_params
        params.require(:prize).permit(
          :name, :description, :value_cents, :tier, :image_url,
          :sponsor_name, :sponsor_logo_url, :position, :image, :remove_image
        )
      end

      def prize_attributes
        prize_params.except(:image, :remove_image)
      end

      def remove_image_requested?
        ActiveModel::Type::Boolean.new.cast(params.dig(:prize, :remove_image))
      end

      def raffle_prizes_for_display
        @tournament.raffle_prizes.with_attached_image.ordered
      end

      def prize_audit_snapshot(prize)
        {
          name: prize.name,
          description: prize.description,
          value_cents: prize.value_cents,
          tier: prize.tier,
          image_url: prize.image_url,
          sponsor_name: prize.sponsor_name,
          sponsor_logo_url: prize.sponsor_logo_url,
          position: prize.position,
          image_attached: prize.image.attached?
        }
      end

      def prize_image_audit_action(prize, remove_image)
        return "removed" if remove_image && prize.image.attached?

        upload = params.dig(:prize, :image)
        return nil unless upload.present? && upload.respond_to?(:tempfile)

        prize.image.attached? ? "replaced" : "added"
      end

      def log_raffle_prize_updated(prize, before_snapshot:, image_action:)
        after_snapshot = prize_audit_snapshot(prize)
        changed_fields = after_snapshot.keys.select { |field| before_snapshot[field] != after_snapshot[field] }
        changed_fields << :image if image_action.present? && !changed_fields.include?(:image)
        changed_fields = changed_fields.map(&:to_s)

        details = if changed_fields.any?
          "Updated raffle prize #{prize.name}: #{changed_fields.join(', ')}"
        else
          "Updated raffle prize #{prize.name}"
        end

        ActivityLog.log(
          admin: current_user, action: 'raffle_prize_updated', target: prize,
          details: details,
          metadata: {
            prize_id: prize.id,
            changed_fields: changed_fields,
            image_action: image_action,
            before: before_snapshot,
            after: after_snapshot
          },
          tournament: @tournament
        )
      end

      def attach_uploaded_image(prize)
        upload = params.dig(:prize, :image)
        return true unless upload.present? && upload.respond_to?(:tempfile)

        if upload.size > MAX_PRIZE_IMAGE_SIZE
          prize.errors.add(:image, "must be smaller than 5MB")
          return false
        end

        content_type = verified_image_content_type(upload)
        unless content_type
          prize.errors.add(:image, "must be a valid JPEG, PNG, GIF, WebP, or AVIF image")
          return false
        end

        upload_io, filename, content_type = prepared_prize_image(upload, content_type)

        prize.image.attach(io: upload_io, filename: filename, content_type: content_type)
        prize.update!(image_url: image_url_for(prize))
        true
      rescue => e
        Rails.logger.error("Failed to attach image to prize #{prize.id}: #{e.message}")
        prize.errors.add(:image, "could not be uploaded")
        false
      ensure
        upload_io&.close! if upload_io.is_a?(Tempfile)
      end

      def prepared_prize_image(upload, content_type)
        return [ upload, upload.original_filename, content_type ] unless content_type == "image/avif"

        normalized_file = Tempfile.new([ File.basename(upload.original_filename, ".*"), ".webp" ])
        normalized_file.binmode

        begin
          image = MiniMagick::Image.open(upload.tempfile.path)
          image.auto_orient
          image.format("webp")
          image.write(normalized_file.path)
          normalized_file.rewind
        rescue MiniMagick::Error, MiniMagick::Invalid
          normalized_file.close!
          raise
        end

        [ normalized_file, "#{File.basename(upload.original_filename, ".*")}.webp", "image/webp" ]
      end

      def image_url_for(prize)
        return prize.image_url unless prize.image.attached?

        Rails.application.routes.url_helpers.rails_blob_url(
          prize.image,
          host: request.base_url
        )
      end

      def prize_response(prize, include_winner: false)
        response = {
          id: prize.id,
          name: prize.name,
          description: prize.description,
          value_cents: prize.value_cents,
          value_dollars: prize.value_dollars,
          tier: prize.tier,
          tier_display: prize.tier_display,
          image_url: image_url_for(prize),
          sponsor_name: prize.sponsor_name,
          sponsor_logo_url: prize.sponsor_logo_url,
          position: prize.position,
          won: prize.won,
          claimed: prize.claimed
        }

        if include_winner && prize.won?
          response[:winner] = {
            name: prize.winner_name,
            won_at: prize.won_at&.iso8601,
            ticket_number: prize.winning_ticket&.display_number
          }
        end

        response
      end

      def ticket_response(ticket, admin: false)
        response = {
          id: ticket.id,
          ticket_number: ticket.display_number,
          purchaser_name: ticket.purchaser_display,
          payment_status: ticket.payment_status,
          is_winner: ticket.is_winner,
          purchased_at: ticket.purchased_at&.iso8601
        }

        if admin
          response[:purchaser_email] = ticket.purchaser_email
          response[:purchaser_phone] = ticket.purchaser_phone
          response[:golfer_id] = ticket.golfer_id
          response[:golfer_name] = ticket.golfer&.name
          response[:price_cents] = ticket.price_cents
          response[:stripe_payment_intent_id] = ticket.stripe_payment_intent_id
          response[:prize_won] = ticket.raffle_prize&.name if ticket.is_winner?
          response[:voided_at] = ticket.voided_at&.iso8601
          response[:void_reason] = ticket.void_reason
          response[:sold_by] = ticket.sold_by_user&.name
          response[:created_at] = ticket.created_at&.iso8601
        end

        response
      end
    end
  end
end
