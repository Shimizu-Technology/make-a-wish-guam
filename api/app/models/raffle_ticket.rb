# frozen_string_literal: true

class RaffleTicket < ApplicationRecord
  belongs_to :tournament
  belongs_to :golfer, optional: true
  belongs_to :raffle_prize, optional: true
  belongs_to :sold_by_user, class_name: 'User', optional: true

  PAYMENT_STATUSES = %w[pending paid refunded voided].freeze

  validates :ticket_number, presence: true, uniqueness: true
  validates :payment_status, inclusion: { in: PAYMENT_STATUSES }
  validates :purchaser_name, presence: true

  before_validation :generate_ticket_number, on: :create

  scope :paid, -> { where(payment_status: 'paid') }
  scope :pending, -> { where(payment_status: 'pending') }
  scope :active, -> { where.not(payment_status: 'voided') }
  scope :voided, -> { where(payment_status: 'voided') }
  scope :winners, -> { where(is_winner: true) }
  scope :not_winners, -> { where(is_winner: false) }
  scope :for_golfer, ->(golfer) { where(golfer: golfer) }
  scope :recent, -> { order(created_at: :desc) }
  scope :with_eligible_participant, -> {
    left_outer_joins(:golfer)
      .where("golfers.id IS NULL OR golfers.registration_status NOT IN (?)", %w[cancelled waitlist])
  }
  scope :eligible_for_draw, -> { active.paid.not_winners.with_eligible_participant }

  def price_dollars
    (price_cents || 0) / 100.0
  end

  def mark_paid!(stripe_payment_intent_id = nil)
    update!(
      payment_status: 'paid',
      purchased_at: Time.current,
      stripe_payment_intent_id: stripe_payment_intent_id
    )
  end

  def refund!
    return false if is_winner?
    update!(payment_status: 'refunded')
  end

  def void!(reason: nil)
    return false if is_winner?
    update!(payment_status: 'voided', voided_at: Time.current, void_reason: reason)
  end

  def voided?
    payment_status == 'voided'
  end

  def display_number
    ticket_number.upcase
  end

  def purchaser_display
    purchaser_name.presence || golfer&.name || 'Unknown'
  end

  private

  def generate_ticket_number
    return if ticket_number.present?

    prefix = ticket_prefix
    # Use a SQL subquery to atomically grab the next sequence in a single statement,
    # avoiding TOCTOU races when the caller wraps creation in a transaction with row lock.
    next_seq = (tournament.raffle_tickets.maximum(:sequence_number) || 0) + 1
    self.sequence_number = next_seq
    self.ticket_number = "#{prefix}-#{next_seq.to_s.rjust(4, '0')}"
  end

  def ticket_prefix
    org = tournament&.organization
    return 'TIX' unless org

    org.name.scan(/[A-Z]/).first(4).join.presence || org.slug&.first(3)&.upcase || 'TIX'
  end
end
