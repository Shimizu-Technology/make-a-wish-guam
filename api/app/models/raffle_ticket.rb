# frozen_string_literal: true

class RaffleTicket < ApplicationRecord
  # Associations
  belongs_to :tournament
  belongs_to :golfer, optional: true
  belongs_to :raffle_prize, optional: true

  # Payment statuses
  PAYMENT_STATUSES = %w[pending paid refunded].freeze

  # Validations
  validates :ticket_number, presence: true, uniqueness: true
  validates :payment_status, inclusion: { in: PAYMENT_STATUSES }
  validates :purchaser_name, presence: true

  # Callbacks
  before_validation :generate_ticket_number, on: :create

  # Scopes
  scope :paid, -> { where(payment_status: 'paid') }
  scope :pending, -> { where(payment_status: 'pending') }
  scope :winners, -> { where(is_winner: true) }
  scope :not_winners, -> { where(is_winner: false) }
  scope :for_golfer, ->(golfer) { where(golfer: golfer) }
  scope :recent, -> { order(created_at: :desc) }

  # Price in dollars
  def price_dollars
    (price_cents || 0) / 100.0
  end

  # Mark as paid
  def mark_paid!(stripe_payment_intent_id = nil)
    update!(
      payment_status: 'paid',
      purchased_at: Time.current,
      stripe_payment_intent_id: stripe_payment_intent_id
    )
  end

  # Refund
  def refund!
    return false if is_winner?
    update!(payment_status: 'refunded')
  end

  # Display ticket number (formatted)
  def display_number
    ticket_number.upcase
  end

  # Purchaser display name
  def purchaser_display
    purchaser_name.presence || golfer&.name || 'Unknown'
  end

  private

  def generate_ticket_number
    return if ticket_number.present?

    prefix = ticket_prefix
    next_seq = (tournament&.raffle_tickets&.maximum(:sequence_number) || 0) + 1
    self.sequence_number = next_seq
    self.ticket_number = "#{prefix}-#{next_seq.to_s.rjust(4, '0')}"
  end

  def ticket_prefix
    org = tournament&.organization
    return 'TIX' unless org

    org.name.scan(/[A-Z]/).first(4).join.presence || org.slug&.first(3)&.upcase || 'TIX'
  end
end
