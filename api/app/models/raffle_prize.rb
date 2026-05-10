# frozen_string_literal: true

class RafflePrize < ApplicationRecord
  # Associations
  belongs_to :tournament
  belongs_to :winning_ticket, class_name: 'RaffleTicket', optional: true

  # Active Storage
  has_one_attached :image

  # Tiers
  TIERS = %w[grand platinum gold silver standard].freeze

  # Validations
  validates :name, presence: true
  validates :tier, inclusion: { in: TIERS }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Scopes
  scope :ordered, -> { order(:position, :tier) }
  scope :available, -> { where(won: false) }
  scope :won, -> { where(won: true) }
  scope :claimed, -> { where(claimed: true) }
  scope :unclaimed, -> { where(won: true, claimed: false) }
  scope :by_tier, ->(tier) { where(tier: tier) }

  # Tier display name
  def tier_display
    tier.titleize
  end

  # Value in dollars
  def value_dollars
    (value_cents || 0) / 100.0
  end

  # Draw a winner from available tickets
  def draw_winner!
    winner_drawn = false
    draw_id = SecureRandom.uuid
    eligible_snapshot = nil

    transaction do
      lock!
      unless won?
        # Lock eligible tickets while selecting so simultaneous draw requests cannot
        # award the same ticket or redraw the same prize.
        available_tickets = tournament.raffle_tickets.eligible_for_draw.order(:id).lock("FOR UPDATE OF raffle_tickets").to_a
        eligible_snapshot = eligible_ticket_snapshot(available_tickets)
        winning_ticket = available_tickets.empty? ? nil : available_tickets[random_ticket_index(available_tickets.length)]

        if winning_ticket
          winning_ticket.update!(
            is_winner: true,
            drawn_at: Time.current,
            raffle_prize: self
          )

          update!(
            won: true,
            won_at: Time.current,
            winning_ticket: winning_ticket,
            winner_name: winning_ticket.purchaser_name,
            winner_email: winning_ticket.purchaser_email,
            winner_phone: winning_ticket.purchaser_phone
          )
          winner_drawn = true
        end
      end
    end

    return false unless winner_drawn

    eligible_snapshot ||= { count: 0, preview_numbers: [] }
    broadcast_draw_started(draw_id: draw_id, eligible_snapshot: eligible_snapshot)
    broadcast_winner(draw_id: draw_id, eligible_snapshot: eligible_snapshot)
    notify_winner

    true
  end

  # Mark as claimed
  def claim!
    return false unless won?
    return true if claimed?

    update!(claimed: true, claimed_at: Time.current)
  end

  # Reset prize (for testing or if draw was invalid)
  def reset!
    return false unless won?

    transaction do
      winning_ticket&.update!(is_winner: false, drawn_at: nil, raffle_prize: nil)
      update!(
        won: false,
        won_at: nil,
        winning_ticket: nil,
        winner_name: nil,
        winner_email: nil,
        winner_phone: nil,
        claimed: false,
        claimed_at: nil
      )
    end

    true
  end

  private

  def random_ticket_index(ticket_count)
    SecureRandom.random_number(ticket_count)
  end

  def eligible_ticket_snapshot(tickets)
    ticket_numbers = tickets.sort_by { |ticket| [ticket.sequence_number.to_i, ticket.id] }.map(&:ticket_number)
    {
      count: ticket_numbers.length,
      preview_numbers: ticket_numbers.sample([ticket_numbers.length, 80].min)
    }
  end

  def broadcast_draw_started(draw_id:, eligible_snapshot:)
    ActionCable.server.broadcast(
      "tournament_#{tournament_id}_raffle",
      {
        action: 'draw_started',
        draw_id: draw_id,
        prize: as_json(only: [:id, :name, :tier, :value_cents]),
        eligible_ticket_count: eligible_snapshot[:count],
        preview_ticket_numbers: eligible_snapshot[:preview_numbers],
        started_at: Time.current.iso8601
      }
    )
  rescue => e
    Rails.logger.error "Failed to broadcast raffle draw start: #{e.message}"
  end

  def broadcast_winner(draw_id:, eligible_snapshot:)
    ActionCable.server.broadcast(
      "tournament_#{tournament_id}_raffle",
      {
        action: 'prize_won',
        draw_id: draw_id,
        eligible_ticket_count: eligible_snapshot[:count],
        prize: as_json(only: [:id, :name, :tier, :value_cents, :winner_name, :won_at]).merge(
          winning_ticket: { ticket_number: winning_ticket&.display_number }
        )
      }
    )
  rescue => e
    Rails.logger.error "Failed to broadcast raffle winner: #{e.message}"
  end

  def notify_winner
    if winner_email.present?
      begin
        RaffleMailer.winner_email(self)
      rescue => e
        Rails.logger.error "Failed to send raffle winner email: #{e.message}"
      end
    end

    begin
      RaffleSmsService.winner_notification(raffle_prize: self)
    rescue => e
      Rails.logger.error "Failed to send raffle winner SMS: #{e.message}"
    end
  end
end
