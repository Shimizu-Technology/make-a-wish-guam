module Api
  module V1
    class GolfersController < BaseController
      skip_before_action :authenticate_user!, only: [:create, :registration_status]
      before_action :authorize_collection_tournament_access!, only: [:index, :stats, :bulk_send_payment_links]
      before_action :authorize_golfer_access!, only: [
        :show, :update, :destroy, :cancel, :refund, :mark_refunded,
        :check_in, :undo_check_in, :payment_details, :promote, :demote,
        :send_payment_link, :update_payment_status
      ]

      # GET /api/v1/golfers
      def index
        tournament = find_tournament
        return render_tournament_required unless tournament

        golfers = tournament.golfers.includes(:group)

        # Apply filters
        golfers = golfers.where(payment_status: params[:payment_status]) if params[:payment_status].present?
        golfers = golfers.where(payment_type: params[:payment_type]) if params[:payment_type].present?
        golfers = golfers.where(registration_status: params[:registration_status]) if params[:registration_status].present?

        if params[:checked_in].present?
          golfers = params[:checked_in] == "true" ? golfers.checked_in : golfers.not_checked_in
        end

        if params[:assigned].present?
          golfers = params[:assigned] == "true" ? golfers.assigned : golfers.unassigned
        end

        golfers = golfers.where(hole_number: params[:hole_number]) if params[:hole_number].present?
        golfers = golfers.joins(:group).where(groups: { group_number: params[:group_number] }) if params[:group_number].present?

        # Search
        if params[:search].present?
          search_term = "%#{params[:search]}%"
          golfers = golfers.where(
            "name ILIKE :search OR email ILIKE :search OR phone ILIKE :search OR mobile ILIKE :search",
            search: search_term
          )
        end

        # Sorting
        sort_by = params[:sort_by] || "created_at"
        sort_order = params[:sort_order] || "desc"
        allowed_sorts = %w[name email created_at payment_status registration_status checked_in_at]
        sort_by = "created_at" unless allowed_sorts.include?(sort_by)
        sort_order = "desc" unless %w[asc desc].include?(sort_order)

        golfers = golfers.order("#{sort_by} #{sort_order}")

        # Paginate
        golfers = paginate(golfers)

        render json: {
          golfers: ActiveModelSerializers::SerializableResource.new(golfers),
          meta: pagination_meta(golfers)
        }
      end

      # GET /api/v1/golfers/:id
      def show
        golfer = Golfer.includes(:group).find(params[:id])
        render json: golfer
      end

      # POST /api/v1/golfers
      # Public registration endpoint
      # Uses database locking to prevent race conditions
      def create
        # Find specific tournament by ID, or fall back to current open tournament
        tournament = if params[:tournament_id].present?
          Tournament.find_by(id: params[:tournament_id])
        else
          Tournament.current
        end
        
        unless tournament
          render json: { errors: ["No tournament is currently open for registration."] }, status: :unprocessable_entity
          return
        end

        # Wrap in transaction with row locking to prevent race conditions
        result = nil
        error_response = nil

        ActiveRecord::Base.transaction do
          # Lock the tournament row to prevent concurrent capacity checks
          tournament.lock!
          
          # Re-check registration status after acquiring lock
          unless tournament.can_register?
            error_response = { errors: ["Registration is currently closed."], status: :unprocessable_entity }
            raise ActiveRecord::Rollback
          end

          golfer = tournament.golfers.new(golfer_params)
          golfer.waiver_accepted_at = Time.current if params[:waiver_accepted]

          if golfer.save
            result = {
              golfer: golfer,
              message: golfer.registration_status == "confirmed" ?
                "Your spot is confirmed!" :
                "You have been added to the waitlist."
            }
          else
            error_response = { errors: golfer.errors.full_messages, status: :unprocessable_entity }
            raise ActiveRecord::Rollback
          end
        end

        # Handle response outside of transaction
        if error_response
          render json: { errors: error_response[:errors] }, status: error_response[:status]
        elsif result
          # Broadcast after transaction commits (non-critical)
          broadcast_golfer_update(result[:golfer])

          render json: {
            golfer: GolferSerializer.new(result[:golfer]),
            message: result[:message]
          }, status: :created
        end
      end

      # PATCH /api/v1/golfers/:id
      def update
        golfer = Golfer.find(params[:id])
        old_values = golfer.attributes.slice('group_id', 'payment_status', 'registration_status', 'name', 'email', 'phone', 'company', 'address', 'payment_notes')

        if golfer.update(golfer_update_params)
          # Log activity for meaningful changes
          log_golfer_update(golfer, old_values)
          broadcast_golfer_update(golfer)
          render json: golfer
        else
          render json: { errors: golfer.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/golfers/:id
      # NOTE: Delete is intentionally not exposed in the UI.
      # Use cancel/refund instead to maintain audit trail.
      # This endpoint exists only for developer/console use if absolutely needed.
      def destroy
        golfer = Golfer.find(params[:id])
        golfer_name = golfer.name
        tournament = golfer.tournament
        golfer.destroy
        
        ActivityLog.log(
          admin: current_admin,
          action: 'golfer_deleted',
          target: nil,
          tournament: tournament,
          details: "Deleted golfer: #{golfer_name}",
          metadata: { golfer_name: golfer_name }
        )
        
        broadcast_golfer_update(golfer, action: "deleted")
        head :no_content
      end

      # POST /api/v1/golfers/:id/cancel
      # Cancel a golfer's registration (without refund)
      def cancel
        golfer = Golfer.find(params[:id])

        unless golfer.can_cancel?
          render json: { error: "Golfer is already cancelled" }, status: :unprocessable_entity
          return
        end

        # If they paid via Stripe, they should use refund instead
        if golfer.payment_status == "paid" && golfer.payment_type == "stripe"
          render json: { error: "This golfer paid via Stripe. Use refund instead to process their cancellation." }, status: :unprocessable_entity
          return
        end

        reason = params[:reason]
        old_group = golfer.group
        
        # CRITICAL: Remove from group first (cancelled golfers shouldn't hold spots)
        if old_group.present?
          golfer.update!(group_id: nil)
        end
        
        # CRITICAL: Cancel the golfer
        golfer.cancel!(admin: current_admin, reason: reason)

        # CRITICAL: Return success response FIRST before non-critical operations
        render json: golfer
        
        # NON-CRITICAL: Log group removal
        if old_group.present?
          begin
            ActivityLog.log(
              admin: current_admin,
              action: 'golfer_removed_from_group',
              target: golfer,
              details: "Removed #{golfer.name} from Hole #{old_group.hole_position_label} (cancelled)"
            )
          rescue StandardError => e
            Rails.logger.error("Failed to log group removal: #{e.message}")
          end
        end

        # NON-CRITICAL: Send cancellation email (wrapped in rescue)
        begin
          GolferMailer.cancellation_email(golfer).deliver_later
        rescue StandardError => e
          Rails.logger.error("Failed to send cancellation email: #{e.message}")
        end

        # NON-CRITICAL: Log activity (wrapped in rescue)
        begin
          ActivityLog.log(
            admin: current_admin,
            action: 'golfer_cancelled',
            target: golfer,
            details: "Cancelled registration for #{golfer.name}",
            metadata: { reason: reason }
          )
        rescue StandardError => e
          Rails.logger.error("Failed to log cancellation activity: #{e.message}")
        end

        # NON-CRITICAL: Broadcast update (wrapped in rescue)
        broadcast_golfer_update(golfer)
      end

      # POST /api/v1/golfers/:id/refund
      # Process a refund through Stripe and cancel the registration
      def refund
        golfer = Golfer.find(params[:id])

        unless golfer.can_refund?
          if golfer.refunded?
            render json: { error: "This golfer has already been refunded" }, status: :unprocessable_entity
          elsif golfer.payment_type != "stripe"
            render json: { error: "This golfer did not pay via Stripe. Use cancel instead." }, status: :unprocessable_entity
          elsif golfer.payment_status != "paid"
            render json: { error: "This golfer has not paid yet. Use cancel instead." }, status: :unprocessable_entity
          else
            render json: { error: "Cannot process refund for this golfer" }, status: :unprocessable_entity
          end
          return
        end

        reason = params[:reason]
        old_group = golfer.group

        begin
          # CRITICAL: Remove from group first (refunded golfers shouldn't hold spots)
          if old_group.present?
            golfer.update!(group_id: nil)
          end
          
          # CRITICAL: Process the refund through Stripe
          stripe_refund = golfer.process_refund!(admin: current_admin, reason: reason)

          # CRITICAL: Return success response FIRST before non-critical operations
          # This ensures user sees success even if activity log or broadcast fails
          render json: {
            success: true,
            golfer: GolferSerializer.new(golfer),
            refund: {
              id: stripe_refund.id,
              amount: stripe_refund.amount,
              status: stripe_refund.status
            },
            message: "Refund processed successfully"
          }

          # NON-CRITICAL: Log group removal if applicable
          if old_group.present?
            begin
              ActivityLog.log(
                admin: current_admin,
                action: 'golfer_removed_from_group',
                target: golfer,
                details: "Removed #{golfer.name} from Hole #{old_group.hole_position_label} (refunded)"
              )
            rescue StandardError => e
              Rails.logger.error("Failed to log group removal: #{e.message}")
            end
          end

          # NON-CRITICAL: Log activity (wrapped in rescue)
          begin
            ActivityLog.log(
              admin: current_admin,
              action: 'golfer_refunded',
              target: golfer,
              details: "Refunded #{golfer.name} - $#{'%.2f' % (stripe_refund.amount / 100.0)}",
              metadata: { 
                reason: reason, 
                refund_id: stripe_refund.id,
                amount_cents: stripe_refund.amount
              }
            )
          rescue StandardError => e
            Rails.logger.error("Failed to log refund activity: #{e.message}")
          end

          # NON-CRITICAL: Broadcast update (already wrapped in rescue in helper method)
          broadcast_golfer_update(golfer)

        rescue Stripe::StripeError => e
          # CRITICAL: Stripe refund failed - this is a real error
          Rails.logger.error("Stripe refund error: #{e.message}")
          render json: { error: "Stripe refund failed: #{e.message}" }, status: :unprocessable_entity
        rescue ActiveRecord::RecordInvalid => e
          # CRITICAL: Database update failed - this is a real error
          Rails.logger.error("Refund database error: #{e.message}")
          render json: { error: "Failed to update golfer record: #{e.message}" }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/golfers/:id/mark_refunded
      # For non-Stripe payments (cash/check) where refund was processed manually
      def mark_refunded
        golfer = Golfer.find(params[:id])

        if golfer.refunded?
          render json: { error: "This golfer has already been refunded" }, status: :unprocessable_entity
          return
        end

        if golfer.payment_type == "stripe" && golfer.payment_status == "paid"
          render json: { error: "This golfer paid via Stripe. Use the refund action to process through Stripe." }, status: :unprocessable_entity
          return
        end

        reason = params[:reason]
        refund_amount = params[:refund_amount_cents] || golfer.payment_amount_cents || golfer.tournament&.entry_fee
        old_group = golfer.group

        # CRITICAL: Remove from group first (refunded golfers shouldn't hold spots)
        if old_group.present?
          golfer.update!(group_id: nil)
        end

        # CRITICAL: Update the golfer record
        golfer.update!(
          registration_status: "cancelled",
          payment_status: "refunded",
          refund_amount_cents: refund_amount,
          refund_reason: reason,
          refunded_at: Time.current,
          refunded_by: current_admin
        )

        # CRITICAL: Return success response FIRST
        render json: golfer
        
        # NON-CRITICAL: Log group removal if applicable
        if old_group.present?
          begin
            ActivityLog.log(
              admin: current_admin,
              action: 'golfer_removed_from_group',
              target: golfer,
              details: "Removed #{golfer.name} from Hole #{old_group.hole_position_label} (refunded)"
            )
          rescue StandardError => e
            Rails.logger.error("Failed to log group removal: #{e.message}")
          end
        end

        # NON-CRITICAL: Send refund notification email
        begin
          GolferMailer.refund_confirmation_email(golfer).deliver_later
        rescue StandardError => e
          Rails.logger.error("Failed to send refund email: #{e.message}")
        end

        # NON-CRITICAL: Log activity
        begin
          ActivityLog.log(
            admin: current_admin,
            action: 'golfer_refunded',
            target: golfer,
            details: "Marked #{golfer.name} as refunded (manual) - $#{'%.2f' % (refund_amount.to_i / 100.0)}",
            metadata: { reason: reason, amount_cents: refund_amount }
          )
        rescue StandardError => e
          Rails.logger.error("Failed to log manual refund activity: #{e.message}")
        end

        # NON-CRITICAL: Broadcast update
        broadcast_golfer_update(golfer)
      end

      # POST /api/v1/golfers/:id/check_in
      def check_in
        golfer = Golfer.find(params[:id])
        was_checked_in = golfer.checked_in_at.present?
        golfer.check_in!

        ActivityLog.log(
          admin: current_admin,
          action: was_checked_in ? 'golfer_unchecked' : 'golfer_checked_in',
          target: golfer,
          details: was_checked_in ? "Unchecked #{golfer.name}" : "Checked in #{golfer.name}"
        )

        broadcast_golfer_update(golfer)
        render json: golfer
      end

      # POST /api/v1/golfers/:id/undo_check_in
      def undo_check_in
        golfer = Golfer.find(params[:id])
        
        unless golfer.checked_in_at.present?
          render json: { error: 'Golfer is not checked in' }, status: :unprocessable_entity
          return
        end

        golfer.update!(checked_in_at: nil)

        ActivityLog.log(
          admin: current_admin,
          action: 'golfer_unchecked',
          target: golfer,
          details: "Unchecked #{golfer.name}"
        )

        broadcast_golfer_update(golfer)
        render json: golfer
      end

      # POST /api/v1/golfers/:id/payment_details
      def payment_details
        golfer = Golfer.find(params[:id])
        old_status = golfer.payment_status
        
        # Calculate the payment amount
        tournament = golfer.tournament
        payment_amount = tournament&.entry_fee || 12500

        golfer.update!(
          payment_status: "paid",
          payment_method: params[:payment_method],
          receipt_number: params[:receipt_number],
          payment_notes: params[:payment_notes],
          payment_amount_cents: payment_amount,
          paid_at: Time.current
        )

        ActivityLog.log(
          admin: current_admin,
          action: 'payment_marked',
          target: golfer,
          details: "Marked #{golfer.name} as paid (#{params[:payment_method]}) - $#{format('%.2f', payment_amount / 100.0)}",
          metadata: {
            payment_method: params[:payment_method],
            receipt_number: params[:receipt_number],
            previous_status: old_status,
            payment_amount_cents: payment_amount
          }
        )

        # Send payment confirmation email
        if golfer.email.present?
          GolferMailer.payment_confirmation_email(golfer).deliver_later
        end

        broadcast_golfer_update(golfer)
        render json: golfer
      end

      # POST /api/v1/golfers/:id/promote
      # Promote from waitlist to confirmed
      def promote
        golfer = Golfer.find(params[:id])

        unless golfer.registration_status == "waitlist"
          render json: { error: "Golfer is not on the waitlist" }, status: :unprocessable_entity
          return
        end

        golfer.update!(registration_status: "confirmed")
        GolferMailer.promotion_email(golfer).deliver_later

        ActivityLog.log(
          admin: current_admin,
          action: 'golfer_promoted',
          target: golfer,
          details: "Promoted #{golfer.name} from waitlist to confirmed"
        )

        broadcast_golfer_update(golfer)
        render json: golfer
      end

      # POST /api/v1/golfers/:id/demote
      # Move a golfer from confirmed to waitlist
      def demote
        golfer = Golfer.find(params[:id])

        unless golfer.registration_status == "confirmed"
          render json: { error: "Golfer is not confirmed" }, status: :unprocessable_entity
          return
        end

        old_group = golfer.group
        
        # Remove from group (waitlist golfers shouldn't hold group spots)
        if old_group.present?
          golfer.update!(group_id: nil)
          ActivityLog.log(
            admin: current_admin,
            action: 'golfer_removed_from_group',
            target: golfer,
            details: "Removed #{golfer.name} from Hole #{old_group.hole_position_label} (demoted to waitlist)"
          )
        end

        golfer.update!(registration_status: "waitlist")

        ActivityLog.log(
          admin: current_admin,
          action: 'golfer_demoted',
          target: golfer,
          details: "Moved #{golfer.name} to waitlist",
          metadata: { previous_status: 'confirmed', new_status: 'waitlist' }
        )

        broadcast_golfer_update(golfer)
        render json: golfer
      end

      # POST /api/v1/golfers/:id/send_payment_link
      # Generate and send payment link to golfer
      def send_payment_link
        golfer = Golfer.find(params[:id])

        unless golfer.can_send_payment_link?
          render json: { error: "Cannot send payment link to this golfer" }, status: :unprocessable_entity
          return
        end

        # Check if this is the first time sending payment link (for admin notification)
        first_time_sending = golfer.payment_token.blank?

        # Generate token if not already present
        golfer.generate_payment_token!

        # Send the payment link email to golfer
        GolferMailer.payment_link_email(golfer).deliver_later

        # Notify admin only if this is the first time sending (not a resend)
        if first_time_sending
          AdminMailer.notify_new_registration_pending_payment(golfer).deliver_later(wait: 2.seconds)
        end

        ActivityLog.log(
          admin: current_admin,
          action: 'payment_link_sent',
          target: golfer,
          details: "Sent payment link to #{golfer.name}",
          metadata: { email: golfer.email }
        )

        render json: {
          success: true,
          message: "Payment link sent to #{golfer.email}",
          payment_link: golfer.payment_link_url
        }
      end

      # POST /api/v1/golfers/:id/update_payment_status
      # Change payment status (paid/unpaid)
      def update_payment_status
        golfer = Golfer.find(params[:id])
        new_status = params[:payment_status]

        unless %w[paid unpaid].include?(new_status)
          render json: { error: "Invalid payment status. Must be 'paid' or 'unpaid'" }, status: :unprocessable_entity
          return
        end

        old_status = golfer.payment_status

        if new_status == 'unpaid'
          # Clear payment details when marking as unpaid (but keep payment_type)
          golfer.update!(
            payment_status: 'unpaid',
            payment_method: nil,
            receipt_number: nil,
            payment_notes: nil,
            paid_at: nil
          )
        else
          golfer.update!(
            payment_status: 'paid',
            paid_at: Time.current
          )
          
          # Send payment confirmation email when marking as paid
          if golfer.email.present?
            GolferMailer.payment_confirmation_email(golfer).deliver_later
          end
        end

        ActivityLog.log(
          admin: current_admin,
          action: 'payment_updated',
          target: golfer,
          details: "Changed #{golfer.name} payment status from #{old_status} to #{new_status}",
          metadata: { previous_status: old_status, new_status: new_status }
        )

        broadcast_golfer_update(golfer)
        render json: golfer
      end

      # POST /api/v1/golfers/bulk_send_payment_links
      # Send payment links to multiple unpaid golfers
      def bulk_send_payment_links
        golfer_ids = params[:golfer_ids]

        unless golfer_ids.is_a?(Array) && golfer_ids.any?
          render json: { error: "golfer_ids must be a non-empty array" }, status: :unprocessable_entity
          return
        end

        # Find all golfers (scoped to tournament)
        tournament = find_tournament
        return render_tournament_required unless tournament

        golfers = tournament.golfers.where(id: golfer_ids)
        
        if golfers.empty?
          render json: { error: "No matching golfers found" }, status: :not_found
          return
        end

        sent_count = 0
        skipped_count = 0
        skipped_reasons = []
        sent_golfers = []

        golfers.find_each do |golfer|
          # Skip if can't send payment link (already paid, cancelled, etc.)
          unless golfer.can_send_payment_link?
            skipped_count += 1
            reason = if golfer.payment_status == "paid"
              "already paid"
            elsif golfer.payment_status == "refunded"
              "refunded"
            elsif golfer.registration_status == "cancelled"
              "cancelled"
            else
              "ineligible"
            end
            skipped_reasons << { name: golfer.name, reason: reason }
            next
          end

          # Check if this is the first time sending payment link (for admin notification)
          first_time_sending = golfer.payment_token.blank?

          # Generate token if not already present
          golfer.generate_payment_token!

          # Send the payment link email to golfer
          GolferMailer.payment_link_email(golfer).deliver_later

          # Notify admin only if this is the first time sending (not a resend)
          if first_time_sending
            AdminMailer.notify_new_registration_pending_payment(golfer).deliver_later(wait: 2.seconds)
          end

          # Log for each golfer individually (shows in their activity history)
          ActivityLog.log(
            admin: current_admin,
            action: 'payment_link_sent',
            target: golfer,
            details: "Sent payment link to #{golfer.name} (bulk action)",
            metadata: { 
              email: golfer.email,
              bulk_action: true,
              resend: !first_time_sending
            }
          )

          sent_golfers << golfer
          sent_count += 1
        end

        render json: {
          success: true,
          message: "Payment links sent to #{sent_count} golfer(s)",
          sent_count: sent_count,
          skipped_count: skipped_count,
          skipped_reasons: skipped_reasons
        }
      end

      # GET /api/v1/golfers/registration_status
      # Public endpoint to check registration capacity
      def registration_status
        tournament = Tournament.current
        settings = Setting.instance

        if tournament
          render json: {
            tournament_id: tournament.id,
            # Total capacity (for admin reference)
            max_capacity: tournament.max_capacity,
            confirmed_count: tournament.confirmed_count,
            waitlist_count: tournament.waitlist_count,
            capacity_remaining: tournament.capacity_remaining,
            at_capacity: tournament.at_capacity?,
            # Public-facing capacity (excludes reserved slots)
            reserved_slots: tournament.reserved_slots,
            public_capacity: tournament.public_capacity,
            public_capacity_remaining: tournament.public_capacity_remaining,
            public_at_capacity: tournament.public_at_capacity?,
            registration_open: tournament.can_register?,
            entry_fee_cents: tournament.entry_fee || 12500,
            entry_fee_dollars: tournament.entry_fee_dollars,
            # Tournament configuration for landing page
            tournament_year: tournament.year,
            tournament_edition: tournament.edition,
            tournament_title: "AIRPORT WEEK", # Could add to Tournament model if needed
            tournament_name: tournament.name,
            event_date: format_event_date(tournament.event_date),
            registration_time: tournament.registration_time,
            start_time: tournament.start_time,
            location_name: tournament.location_name,
            location_address: tournament.location_address,
            format_name: tournament.format_name,
            fee_includes: tournament.fee_includes,
            checks_payable_to: tournament.checks_payable_to,
            contact_name: tournament.contact_name,
            contact_phone: tournament.contact_phone,
            # Global settings
            stripe_configured: settings.stripe_configured?,
            stripe_public_key: settings.stripe_public_key.presence,
            payment_mode: settings.payment_mode
          }
        else
          render json: {
            registration_open: false,
            error: "No tournament is currently open"
          }
        end
      end

      # GET /api/v1/golfers/stats
      def stats
        tournament = find_tournament
        return render_tournament_required unless tournament

        # Exclude cancelled golfers from active counts
        active_golfers = tournament.golfers.where.not(registration_status: 'cancelled')
        
        render json: {
          tournament_id: tournament.id,
          tournament_name: tournament.name,
          total: active_golfers.count,
          confirmed: tournament.confirmed_count,
          waitlist: tournament.waitlist_count,
          cancelled: tournament.golfers.where(registration_status: 'cancelled').count,
          paid: active_golfers.where(payment_status: 'paid').count,
          unpaid: active_golfers.where.not(payment_status: 'paid').count,
          checked_in: active_golfers.where.not(checked_in_at: nil).count,
          not_checked_in: active_golfers.where(checked_in_at: nil).count,
          assigned_to_groups: active_golfers.where.not(group_id: nil).count,
          unassigned: active_golfers.where(group_id: nil).count,
          max_capacity: tournament.max_capacity,
          reserved_slots: tournament.reserved_slots,
          public_capacity: tournament.public_capacity,
          capacity_remaining: tournament.capacity_remaining,
          at_capacity: tournament.at_capacity?,
          entry_fee_cents: tournament.entry_fee || 12500,
          entry_fee_dollars: tournament.entry_fee_dollars
        }
      end

      private

      def authorize_collection_tournament_access!
        tournament = find_tournament
        return render_tournament_required unless tournament

        require_tournament_admin!(tournament)
      end

      def authorize_golfer_access!
        golfer = Golfer.find(params[:id])
        require_tournament_admin!(golfer.tournament)
      end

      def find_tournament
        if params[:tournament_id].present?
          Tournament.find(params[:tournament_id])
        else
          Tournament.current
        end
      end

      def render_tournament_required
        render json: { error: "Tournament not found or not specified" }, status: :not_found
      end

      def golfer_params
        params.require(:golfer).permit(
          :name, :company, :address, :phone, :mobile, :email,
          :payment_type, :payment_status, :notes
        )
      end

      def golfer_update_params
        params.require(:golfer).permit(
          :name, :company, :address, :phone, :mobile, :email,
          :payment_type, :payment_status, :registration_status,
          :group_id, :hole_number, :position, :notes,
          :payment_method, :receipt_number, :payment_notes
        )
      end

      def broadcast_golfer_update(golfer, action: "updated")
        ActionCable.server.broadcast("golfers_channel_#{golfer.tournament_id}", {
          action: action,
          golfer: GolferSerializer.new(golfer).as_json
        })
      rescue StandardError => e
        Rails.logger.error("Failed to broadcast golfer update: #{e.message}")
      end

      def format_event_date(date)
        return nil if date.nil?
        return date if date.is_a?(String) # Already formatted string
        date.strftime("%B %-d, %Y") # Format Date/DateTime objects
      rescue
        date.to_s # Fallback to string conversion
      end

      def log_golfer_update(golfer, old_values)
        return unless current_admin

        # Check for group assignment changes
        if old_values['group_id'] != golfer.group_id
          if golfer.group_id.present? && old_values['group_id'].nil?
            ActivityLog.log(
              admin: current_admin,
              action: 'golfer_assigned_to_group',
              target: golfer,
              details: "Assigned #{golfer.name} to Hole #{golfer.group&.hole_position_label}",
              metadata: { group_id: golfer.group_id, hole_label: golfer.group&.hole_position_label }
            )
          elsif golfer.group_id.nil? && old_values['group_id'].present?
            ActivityLog.log(
              admin: current_admin,
              action: 'golfer_removed_from_group',
              target: golfer,
              details: "Removed #{golfer.name} from group",
              metadata: { previous_group_id: old_values['group_id'] }
            )
          elsif golfer.group_id.present?
            ActivityLog.log(
              admin: current_admin,
              action: 'golfer_assigned_to_group',
              target: golfer,
              details: "Moved #{golfer.name} to Hole #{golfer.group&.hole_position_label}",
              metadata: { 
                group_id: golfer.group_id, 
                hole_label: golfer.group&.hole_position_label,
                previous_group_id: old_values['group_id']
              }
            )
          end
        end

        # Check for payment status changes
        if old_values['payment_status'] != golfer.payment_status
          ActivityLog.log(
            admin: current_admin,
            action: 'payment_updated',
            target: golfer,
            details: "Changed #{golfer.name} payment status from #{old_values['payment_status']} to #{golfer.payment_status}",
            metadata: {
              previous_status: old_values['payment_status'],
              new_status: golfer.payment_status
            }
          )
        end

        # Check for payment notes changes
        if old_values['payment_notes'] != golfer.payment_notes
          old_notes = old_values['payment_notes'].presence || '(empty)'
          new_notes = golfer.payment_notes.presence || '(empty)'
          
          # Truncate for display in details (keep full in metadata)
          old_notes_display = old_notes.length > 50 ? "#{old_notes[0..47]}..." : old_notes
          new_notes_display = new_notes.length > 50 ? "#{new_notes[0..47]}..." : new_notes
          
          ActivityLog.log(
            admin: current_admin,
            action: 'payment_notes_updated',
            target: golfer,
            details: "Updated payment notes for #{golfer.name}",
            metadata: {
              previous_notes: old_values['payment_notes'],
              new_notes: golfer.payment_notes
            }
          )
        end

        # Check for contact info changes
        contact_fields = %w[name email phone company address]
        changed_fields = contact_fields.select { |field| old_values[field] != golfer.send(field) }
        
        if changed_fields.any?
          changes = changed_fields.map do |field|
            old_val = old_values[field].presence || '(empty)'
            new_val = golfer.send(field).presence || '(empty)'
            "#{field}: #{old_val} → #{new_val}"
          end
          
          ActivityLog.log(
            admin: current_admin,
            action: 'golfer_updated',
            target: golfer,
            details: "Updated #{golfer.name}'s details: #{changed_fields.join(', ')}",
            metadata: {
              changed_fields: changed_fields,
              changes: changed_fields.each_with_object({}) { |f, h| 
                h[f] = { from: old_values[f], to: golfer.send(f) } 
              }
            }
          )
        end
      end
    end
  end
end
