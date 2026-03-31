class GolferSerializer < ActiveModel::Serializer
  attributes :id, :tournament_id, :name, :last_name, :company, :address, :phone, :mobile, :email,
             :payment_type, :payment_status, :waiver_accepted_at,
             :checked_in_at, :registration_status, :group_id, :hole_number,
             :position, :notes, :payment_method, :receipt_number, :payment_notes,
             :created_at, :updated_at, :group_position_label, :hole_position_label, :checked_in, :waiver_signed,
             # Payment link
             :payment_token,
             # Refund/payment detail fields
             :stripe_card_brand, :stripe_card_last4, :payment_amount_cents,
             :stripe_refund_id, :refund_amount_cents, :refund_reason, :refunded_at,
             :refunded_by_name, :can_refund, :can_cancel, :cancelled, :refunded,
             :formatted_payment_timestamp,
             # Payment timing fields
             :paid_at, :payment_timing, :payment_channel

  belongs_to :group, optional: true

  def checked_in
    object.checked_in?
  end

  # Extract last name (last word of the full name) for sorting
  def last_name
    return nil unless object.name.present?
    object.name.split.last
  end

  def waiver_signed
    object.waiver_accepted_at.present?
  end

  def group_position_label
    object.group_position_label
  end

  def hole_position_label
    object.hole_position_label
  end

  # Get hole_number from the group, not from the golfer directly
  def hole_number
    object.group&.hole_number
  end

  def refunded_by_name
    object.refunded_by&.name || object.refunded_by&.email
  end

  def can_refund
    object.can_refund?
  end

  def can_cancel
    object.can_cancel?
  end

  def cancelled
    object.cancelled?
  end

  def refunded
    object.refunded?
  end

  # Format the payment timestamp nicely
  def formatted_payment_timestamp
    return nil unless object.payment_notes.present?
    
    # Try to extract and format the timestamp from payment_notes
    # If the payment was made via Stripe, format the timestamp from when it was recorded
    if object.payment_status == "paid" && object.payment_type == "stripe"
      # Find the timestamp in the payment notes
      if match = object.payment_notes&.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
        begin
          time = Time.parse(match[1])
          return time.in_time_zone('Pacific/Guam').strftime('%B %d, %Y at %I:%M %p')
        rescue
          nil
        end
      end
    end
    nil
  end

  # Determine if payment was day-of or pre-paid
  # Returns: 'day_of', 'pre_paid', or nil if not paid
  def payment_timing
    return nil unless object.payment_status == 'paid'
    return nil unless object.paid_at.present?
    
    tournament = object.tournament
    return nil unless tournament&.event_date.present?
    
    # Parse the tournament event date (stored as string like "January 9, 2026")
    begin
      event_date = Date.parse(tournament.event_date)
      payment_date = object.paid_at.to_date
      
      if payment_date >= event_date
        'day_of'
      else
        'pre_paid'
      end
    rescue ArgumentError
      nil
    end
  end

  # Determine the payment channel
  # Returns: 'stripe_online', 'credit_venue', 'cash', 'check', or nil
  def payment_channel
    return nil unless object.payment_status == 'paid'
    
    # If has Stripe payment intent, it was paid online via Stripe
    if object.stripe_payment_intent_id.present?
      'stripe_online'
    elsif object.payment_method == 'credit'
      'credit_venue'
    elsif object.payment_method == 'cash'
      'cash'
    elsif object.payment_method == 'check'
      'check'
    else
      nil
    end
  end
end
