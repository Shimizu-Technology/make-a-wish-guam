class TournamentSerializer < ActiveModel::Serializer
  attributes :id, :name, :slug, :year, :edition, :status,
             :event_date, :registration_time, :start_time,
             :location_name, :location_address,
             :max_capacity, :reserved_slots,
             :entry_fee, :entry_fee_dollars,
             :format_name, :fee_includes, :checks_payable_to,
             :contact_name, :contact_phone,
             :registration_open, :can_register,
             :confirmed_count, :waitlist_count,
             :capacity_remaining, :at_capacity,
             :public_capacity, :public_capacity_remaining, :public_at_capacity,
             :checked_in_count, :paid_count,
             :display_name, :short_name,
             :organization_id, :organization_slug,
             # New configuration fields
             :tournament_format, :scoring_type, :team_size, :allow_partial_teams,
             :handicap_required, :handicap_max,
             :use_flights, :flights_config,
             # Pricing
             :early_bird_fee, :early_bird_fee_dollars, :early_bird_deadline,
             :early_bird_active, :current_fee, :current_fee_dollars,
             # Registration
             :registration_deadline, :waitlist_enabled, :waitlist_max,
             # Payment
             :payment_instructions, :allow_cash, :allow_check, :allow_card,
             # Schedule
             :check_in_time, :shotgun_start, :tee_times_enabled, :tee_time_interval_minutes,
             :created_at, :updated_at

  def organization_slug
    object.organization&.slug
  end

  def early_bird_fee_dollars
    object.early_bird_fee_dollars
  end

  def early_bird_active
    object.early_bird_active?
  end

  def current_fee
    object.current_fee
  end

  def current_fee_dollars
    object.current_fee_dollars
  end

  def entry_fee_dollars
    object.entry_fee_dollars
  end

  def can_register
    object.can_register?
  end

  def confirmed_count
    object.confirmed_count
  end

  def waitlist_count
    object.waitlist_count
  end

  def capacity_remaining
    object.capacity_remaining
  end

  def at_capacity
    object.at_capacity?
  end

  def public_capacity
    object.public_capacity
  end

  def public_capacity_remaining
    object.public_capacity_remaining
  end

  def public_at_capacity
    object.public_at_capacity?
  end

  def checked_in_count
    object.checked_in_count
  end

  def paid_count
    object.paid_count
  end

  def display_name
    object.display_name
  end

  def short_name
    object.short_name
  end

  def created_at
    object.created_at.in_time_zone('Guam').iso8601
  end

  def updated_at
    object.updated_at.in_time_zone('Guam').iso8601
  end
end

