class Golfer < ApplicationRecord
  belongs_to :tournament
  belongs_to :group, optional: true
  belongs_to :sponsor, optional: true
  belongs_to :refunded_by, class_name: "User", optional: true
  belongs_to :payment_verified_by, class_name: "User", foreign_key: :payment_verified_by_id, optional: true
  belongs_to :checked_in_by, class_name: "User", foreign_key: :checked_in_by_id, optional: true
  has_many :scores, dependent: :destroy
  has_many :raffle_tickets, dependent: :nullify

  # Validations
  validates :name, presence: true
  validates :email, presence: true, 
                    uniqueness: { scope: :tournament_id, message: "has already registered for this tournament" },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :phone, presence: true, unless: :sponsored?
  validates :payment_type, presence: true, inclusion: { in: %w[stripe pay_on_day swipe_simple walk_in sponsor] }
  validates :payment_status, inclusion: { in: %w[paid unpaid pending refunded], allow_nil: true }
  validates :registration_status, inclusion: { in: %w[confirmed waitlist cancelled], allow_nil: true }
  validates :waiver_accepted_at, presence: true, unless: :sponsored?
  validates :tournament_id, presence: true

  # Scopes - Active golfers (not cancelled)
  scope :active, -> { where.not(registration_status: "cancelled") }
  scope :confirmed, -> { where(registration_status: "confirmed") }
  scope :waitlist, -> { where(registration_status: "waitlist") }
  scope :cancelled, -> { where(registration_status: "cancelled") }
  
  # Payment scopes
  scope :paid, -> { where(payment_status: "paid") }
  scope :unpaid, -> { where(payment_status: "unpaid") }
  scope :refunded, -> { where(payment_status: "refunded") }
  
  # Check-in scopes
  scope :checked_in, -> { where.not(checked_in_at: nil) }
  scope :not_checked_in, -> { where(checked_in_at: nil) }
  
  # Group scopes
  scope :unassigned, -> { where(group_id: nil) }
  scope :assigned, -> { where.not(group_id: nil) }
  
  # Payment type scopes
  scope :pay_now, -> { where(payment_type: "stripe") }
  scope :pay_on_day, -> { where(payment_type: "pay_on_day") }
  
  # Tournament scope
  scope :for_tournament, ->(tournament_id) { where(tournament_id: tournament_id) }

  # Set registration status based on capacity
  before_validation :set_registration_status, on: :create
  before_validation :set_default_payment_status, on: :create

  # Callbacks - use after_commit to ensure golfer is persisted before jobs run
  # For Stripe payments, emails are sent AFTER payment is confirmed (in CheckoutController#confirm)
  # For pay_on_day, emails are sent immediately on registration
  after_commit :send_confirmation_email, on: :create, if: :should_send_immediate_emails?
  after_commit :send_sms_confirmation, on: :create, if: :should_send_immediate_emails?
  after_commit :notify_admin, on: :create, if: :should_send_immediate_emails?


  # Status check methods
  def checked_in?
    checked_in_at.present?
  end

  def cancelled?
    registration_status == "cancelled"
  end

  def refunded?
    payment_status == "refunded"
  end

  def can_refund?
    payment_status == "paid" && payment_type == "stripe" && stripe_payment_intent_id.present? && !refunded?
  end

  def can_cancel?
    !cancelled?
  end

  # Magic Link methods
  MAGIC_LINK_EXPIRY = 24.hours

  def generate_magic_link!
    token = SecureRandom.urlsafe_base64(32)
    update!(
      magic_link_token: token,
      magic_link_expires_at: Time.current + MAGIC_LINK_EXPIRY
    )
    token
  end

  def magic_link_valid?
    magic_link_token.present? && 
      magic_link_expires_at.present? && 
      magic_link_expires_at > Time.current
  end

  def clear_magic_link!
    update!(magic_link_token: nil, magic_link_expires_at: nil)
  end

  def magic_link_url
    return nil unless magic_link_token.present?
    frontend_url = ENV.fetch("FRONTEND_URL", "http://localhost:5173")
    "#{frontend_url}/score/verify?token=#{magic_link_token}"
  end

  # Find golfer by magic link token (class method)
  def self.find_by_magic_link(token)
    return nil if token.blank?
    
    golfer = find_by(magic_link_token: token)
    return nil unless golfer&.magic_link_valid?
    
    golfer
  end

  # Find golfers by email for active tournaments (class method)
  def self.find_for_scoring_access(email)
    return [] if email.blank?

    # Find active tournaments (open, in_progress, or recently completed)
    active_statuses = %w[open closed in_progress]
    
    joins(:tournament)
      .where(email: email.downcase.strip)
      .where(tournaments: { status: active_statuses })
      .where.not(registration_status: "cancelled")
      .includes(:tournament, :group)
      .order("tournaments.event_date DESC")
  end

  def check_in!(admin: nil)
    if checked_in?
      assign_attributes(checked_in_at: nil, checked_in_by_id: nil, checked_in_by_name: nil)
    else
      assign_attributes(
        checked_in_at: Time.current,
        checked_in_by_id: admin&.id,
        checked_in_by_name: admin&.name || admin&.email
      )
    end
    save!(validate: false)
  end

  def verify_payment!(admin:, method: nil, notes: nil)
    attrs = {
      payment_status: 'paid',
      paid_at: Time.current,
      payment_method: method,
      payment_notes: notes,
      payment_verified_by_id: admin.id,
      payment_verified_by_name: admin.name || admin.email,
      payment_verified_at: Time.current
    }
    attrs[:payment_amount_cents] = tournament&.entry_fee if payment_amount_cents.blank?
    assign_attributes(attrs)
    save!(validate: false)
  end

  def create_raffle_tickets!
    return unless tournament&.raffle_enabled?

    # Row-level lock prevents concurrent mark_paid/verify_payment races
    with_lock do
      existing = tournament.raffle_tickets.where(golfer_id: id, price_cents: [0, nil]).order(:id)
      captain_ticket = existing.first
      partner_ticket = existing.second

      if captain_ticket
        captain_ticket.update!(purchaser_name: name, purchaser_email: email, purchaser_phone: phone)
      else
        tournament.raffle_tickets.create!(
          golfer_id: id,
          purchaser_name: name,
          purchaser_email: email,
          purchaser_phone: phone,
          price_cents: 0,
          payment_status: 'paid',
          purchased_at: Time.current
        )
      end

      if partner_name.present?
        if partner_ticket
          partner_ticket.update!(
            purchaser_name: partner_name,
            purchaser_email: partner_email.presence || email,
            purchaser_phone: partner_phone.presence || phone
          )
        elsif existing.count < 2
          tournament.raffle_tickets.create!(
            golfer_id: id,
            purchaser_name: partner_name,
            purchaser_email: partner_email.presence || email,
            purchaser_phone: partner_phone.presence || phone,
            price_cents: 0,
            payment_status: 'paid',
            purchased_at: Time.current
          )
        end
      elsif partner_ticket
        partner_ticket.destroy!
      end
    end
  end

  # Cancel a golfer's registration (without refund - for unpaid or non-Stripe payments)
  def cancel!(admin: nil, reason: nil)
    assign_attributes(
      registration_status: "cancelled",
      refund_reason: reason,
      refunded_at: Time.current,
      refunded_by: admin
    )
    save!(validate: false)
  end

  # Process a refund through Stripe and cancel the registration
  def process_refund!(admin:, reason: nil)
    raise "Cannot refund - not a Stripe payment" unless payment_type == "stripe"
    raise "Cannot refund - no payment intent" unless stripe_payment_intent_id.present?
    raise "Already refunded" if refunded?

    setting = Setting.instance
    raise "Stripe not configured" unless setting.stripe_secret_key.present?

    Stripe.api_key = setting.stripe_secret_key

    # Process the refund through Stripe
    refund = Stripe::Refund.create({
      payment_intent: stripe_payment_intent_id,
      reason: "requested_by_customer"
    })

    # Update the golfer record
    update!(
      registration_status: "cancelled",
      payment_status: "refunded",
      stripe_refund_id: refund.id,
      refund_amount_cents: refund.amount,
      refund_reason: reason,
      refunded_at: Time.current,
      refunded_by: admin
    )

    # Send refund notification email
    GolferMailer.refund_confirmation_email(self).deliver_later rescue nil

    refund
  end

  def group_position_label
    return nil unless group && position
    letter = ("a".."d").to_a[position.to_i - 1] || "x"
    "#{group.group_number}#{letter.upcase}"
  end

  # New hole-based position label (e.g., "7A" for first foursome at Hole 7)
  # The letter indicates which foursome at that hole, not the player's position
  # Always includes a letter suffix for consistency (even if only one foursome at that hole)
  def hole_position_label
    return nil unless group
    return "Unassigned" unless group.hole_number

    # Get all groups at this hole, sorted by group_number for consistent ordering
    groups_at_hole = Group.where(
      tournament_id: tournament_id,
      hole_number: group.hole_number
    ).order(:group_number)

    # Find this group's index among all groups at this hole
    group_ids = groups_at_hole.pluck(:id)
    position_index = group_ids.index(group.id)
    
    # Always add letter suffix for consistency
    position_letter = ('A'..'Z').to_a[position_index] || 'X'
    "#{group.hole_number}#{position_letter}"
  end

  # Check if this is a Stripe payment that's been confirmed
  def stripe_payment_confirmed?
    payment_type == "stripe" && payment_status == "paid" && stripe_payment_intent_id.present?
  end

  # Generate a unique payment token for payment links
  def generate_payment_token!
    return payment_token if payment_token.present?
    
    loop do
      token = SecureRandom.urlsafe_base64(24)
      unless Golfer.exists?(payment_token: token)
        update!(payment_token: token)
        return token
      end
    end
  end

  # Get the payment link URL
  def payment_link_url
    return nil unless payment_token.present?
    frontend_url = ENV.fetch("FRONTEND_URL", "http://localhost:5173")
    "#{frontend_url}/pay/#{payment_token}"
  end

  # Check if payment link can be sent
  def can_send_payment_link?
    payment_status != "paid" && payment_status != "refunded" && registration_status != "cancelled"
  end

  # Format payment details for display
  def formatted_payment_details
    return nil unless payment_status == "paid" || payment_status == "refunded"

    details = []
    
    if payment_amount_cents.present?
      details << "Amount: $#{'%.2f' % (payment_amount_cents / 100.0)}"
    end

    if stripe_card_brand.present? && stripe_card_last4.present?
      details << "Card: #{stripe_card_brand.capitalize} •••• #{stripe_card_last4}"
    end

    if stripe_payment_intent_id.present?
      details << "Transaction: #{stripe_payment_intent_id}"
    end

    details.join("\n")
  end

  # Format refund details for display
  def formatted_refund_details
    return nil unless refunded?

    details = []
    
    if refund_amount_cents.present?
      details << "Refunded: $#{'%.2f' % (refund_amount_cents / 100.0)}"
    end

    if stripe_refund_id.present?
      details << "Refund ID: #{stripe_refund_id}"
    end

    if refunded_at.present?
      details << "Date: #{refunded_at.in_time_zone('Pacific/Guam').strftime('%B %d, %Y at %I:%M %p')} (Guam Time)"
    end

    if refund_reason.present?
      details << "Reason: #{refund_reason}"
    end

    if refunded_by.present?
      details << "Processed by: #{refunded_by.name || refunded_by.email}"
    end

    details.join("\n")
  end

  private

  # For Stripe payments, don't send emails until payment is confirmed
  # For pay_on_day, send emails immediately
  def sponsored?
    payment_type == 'sponsor'
  end

  def should_send_immediate_emails?
    %w[pay_on_day swipe_simple walk_in].include?(payment_type)
  end

  def set_registration_status
    return if registration_status.present?
    return unless tournament

    # Use public capacity for automatic status assignment
    # Admin-added golfers using reserved slots can have status manually set
    if tournament.public_at_capacity?
      self.registration_status = "waitlist"
    else
      self.registration_status = "confirmed"
    end
  end

  def set_default_payment_status
    return if payment_status.present?
    
    # All new registrations start as unpaid
    # Stripe payments will be marked as paid after successful checkout
    # Pay on day payments will be marked as paid at check-in
    self.payment_status = "unpaid"
  end

  def send_confirmation_email
    return if Rails.env.test?
    GolferMailer.confirmation_email(self).deliver_later
    # Also send to partner if they have a different email
    if partner_email.present? && partner_email != email
      GolferMailer.partner_confirmation_email(self).deliver_later rescue nil
    end
  rescue StandardError => e
    Rails.logger.error("Failed to send golfer confirmation email: #{e.message}")
  end

  def send_sms_confirmation
    return if Rails.env.test?
    SmsService.send_registration_confirmation(self)
  rescue StandardError => e
    Rails.logger.error("Failed to send SMS confirmation: #{e.message}")
  end

  def notify_admin
    return if Rails.env.test?
    AdminMailer.notify_new_golfer(self).deliver_later
  rescue StandardError => e
    Rails.logger.error("Failed to send admin notification email: #{e.message}")
  end
end
