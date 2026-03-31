# frozen_string_literal: true

module Api
  module V1
    class RaffleController < BaseController
      skip_before_action :authenticate_user!, only: [:prizes, :tickets, :board]
      before_action :set_tournament
      before_action :authorize_tournament_admin!, only: [
        :create_prize, :update_prize, :destroy_prize,
        :draw, :draw_all, :reset_prize, :claim_prize,
        :admin_tickets, :create_tickets, :mark_ticket_paid, :destroy_ticket
      ]

      # ===========================================
      # PUBLIC ENDPOINTS
      # ===========================================

      # GET /api/v1/tournaments/:tournament_id/raffle/prizes
      # Public - get all prizes for raffle board
      def prizes
        prizes = @tournament.raffle_prizes.ordered

        render json: {
          tournament: {
            id: @tournament.id,
            name: @tournament.name,
            raffle_enabled: @tournament.raffle_enabled,
            raffle_ticket_price_cents: @tournament.raffle_ticket_price_cents,
            raffle_draw_time: @tournament.raffle_draw_time
          },
          prizes: prizes.map { |p| prize_response(p) }
        }
      end

      # GET /api/v1/tournaments/:tournament_id/raffle/board
      # Public - get raffle board display data
      def board
        prizes = @tournament.raffle_prizes.ordered
        
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
            total_tickets_sold: @tournament.raffle_tickets.paid.count
          },
          last_updated: Time.current.iso8601
        }
      end

      # GET /api/v1/tournaments/:tournament_id/raffle/tickets
      # Public - get ticket count for a purchaser (by email)
      def tickets
        email = params[:email]
        return render json: { error: 'Email required' }, status: :bad_request unless email.present?

        tickets = @tournament.raffle_tickets.paid.where(purchaser_email: email.downcase)

        render json: {
          email: email,
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
        prize = @tournament.raffle_prizes.build(prize_params)

        if prize.save
          render json: { prize: prize_response(prize), message: 'Prize created' }, status: :created
        else
          render json: { error: prize.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/tournaments/:tournament_id/raffle/prizes/:id
      # Admin - update a prize
      def update_prize
        prize = @tournament.raffle_prizes.find(params[:id])

        if prize.update(prize_params)
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
          prize.destroy
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

        render json: {
          results: results,
          message: "Drew #{results.count(&:success)} winners"
        }
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/prizes/:id/reset
      # Admin - reset a prize (undo draw)
      def reset_prize
        prize = @tournament.raffle_prizes.find(params[:id])

        if prize.reset!
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
          render json: { prize: prize_response(prize), message: 'Prize marked as claimed' }
        else
          render json: { error: 'Cannot claim prize' }, status: :unprocessable_entity
        end
      end

      # ===========================================
      # ADMIN ENDPOINTS - Tickets
      # ===========================================

      # GET /api/v1/tournaments/:tournament_id/raffle/admin/tickets
      # Admin - list all tickets
      def admin_tickets
        tickets = @tournament.raffle_tickets.includes(:golfer, :raffle_prize).recent

        # Filter by status
        tickets = tickets.where(payment_status: params[:status]) if params[:status].present?

        render json: {
          tickets: tickets.map { |t| ticket_response(t, admin: true) },
          stats: {
            total: @tournament.raffle_tickets.count,
            paid: @tournament.raffle_tickets.paid.count,
            pending: @tournament.raffle_tickets.pending.count,
            winners: @tournament.raffle_tickets.winners.count
          }
        }
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/tickets
      # Admin - create tickets (manual sale)
      def create_tickets
        quantity = (params[:quantity] || 1).to_i
        
        tickets = []
        quantity.times do
          ticket = @tournament.raffle_tickets.build(
            purchaser_name: params[:purchaser_name],
            purchaser_email: params[:purchaser_email]&.downcase,
            purchaser_phone: params[:purchaser_phone],
            golfer_id: params[:golfer_id],
            price_cents: @tournament.raffle_ticket_price_cents,
            payment_status: params[:mark_paid] ? 'paid' : 'pending',
            purchased_at: params[:mark_paid] ? Time.current : nil
          )
          
          if ticket.save
            tickets << ticket
          else
            render json: { error: ticket.errors.full_messages.join(', ') }, status: :unprocessable_entity
            return
          end
        end

        render json: {
          tickets: tickets.map { |t| ticket_response(t) },
          message: "#{tickets.count} ticket(s) created"
        }, status: :created
      end

      # POST /api/v1/tournaments/:tournament_id/raffle/tickets/:id/mark_paid
      # Admin - mark ticket as paid
      def mark_ticket_paid
        ticket = @tournament.raffle_tickets.find(params[:id])
        ticket.mark_paid!

        render json: { ticket: ticket_response(ticket), message: 'Ticket marked as paid' }
      end

      # DELETE /api/v1/tournaments/:tournament_id/raffle/tickets/:id
      # Admin - delete/refund ticket
      def destroy_ticket
        ticket = @tournament.raffle_tickets.find(params[:id])

        if ticket.is_winner?
          render json: { error: 'Cannot delete a winning ticket' }, status: :unprocessable_entity
        else
          ticket.destroy
          render json: { message: 'Ticket deleted' }
        end
      end

      private

      def set_tournament
        @tournament = Tournament.find(params[:tournament_id])
      end

      def authorize_tournament_admin!
        require_tournament_admin!(@tournament)
      end

      def prize_params
        params.require(:prize).permit(
          :name, :description, :value_cents, :tier, :image_url,
          :sponsor_name, :sponsor_logo_url, :position
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
          image_url: prize.image_url,
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
        end

        response
      end
    end
  end
end
