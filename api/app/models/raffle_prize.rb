# frozen_string_literal: true

class RafflePrize < ApplicationRecord
  # Associations
  belongs_to :tournament
  belongs_to :winning_ticket, class_name: 'RaffleTicket', optional: true

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
    return false if won?
    
    available_tickets = tournament.raffle_tickets.paid.not_winners
    return false if available_tickets.empty?

    # Random selection
    winning_ticket = available_tickets.sample

    transaction do
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
    end

    # Broadcast winner
    broadcast_winner
    
    # Send winner notification email
    send_winner_email

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

  def broadcast_winner
    ActionCable.server.broadcast(
      "tournament_#{tournament_id}_raffle",
      {
        action: 'prize_won',
        prize: as_json(only: [:id, :name, :tier, :value_cents, :winner_name, :won_at])
      }
    )
  rescue => e
    Rails.logger.error "Failed to broadcast raffle winner: #{e.message}"
  end

  def send_winner_email
    return unless winner_email.present?
    
    # Call mailer directly (Resend sends immediately)
    RaffleMailer.winner_email(self)
  rescue => e
    Rails.logger.error "Failed to send raffle winner email: #{e.message}"
  end
end
