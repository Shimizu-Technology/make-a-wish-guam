class SponsorSlotSyncer
  # Syncs SponsorSlot data into Golfer records so sponsored players
  # appear in registrations, check-in, hole assignment, and reports.
  #
  # Team mapping: slots 1-2 = Team 1, slots 3-4 = Team 2, etc.
  # Odd slot = captain, even slot = partner on the same Golfer record.
  #
  # Finding logic: uses team_name ("Sponsor - Team N") as the stable
  # identifier so email/name changes don't create duplicate records.

  def initialize(sponsor)
    @sponsor = sponsor
    @tournament = sponsor.tournament
  end

  def sync_all
    slots = @sponsor.sponsor_slots.order(:slot_number).to_a
    slots.each_slice(2).with_index do |(captain_slot, partner_slot), team_idx|
      sync_team(captain_slot, partner_slot, team_idx + 1)
    end
  end

  # Returns true on success, raises on failure so callers can surface the error.
  def sync_slot(slot)
    team_number = ((slot.slot_number - 1) / 2) + 1
    pair_start = (team_number - 1) * 2 + 1
    captain_slot = @sponsor.sponsor_slots.find_by(slot_number: pair_start)
    partner_slot = @sponsor.sponsor_slots.find_by(slot_number: pair_start + 1)
    sync_team(captain_slot, partner_slot, team_number)
    true
  end

  private

  def sync_team(captain_slot, partner_slot, team_number)
    captain_name = captain_slot&.player_name&.strip.presence
    expected_team_name = "#{@sponsor.name} - Team #{team_number}"
    email = captain_email_for(captain_slot, team_number)

    golfer = find_existing_golfer(expected_team_name, email, team_number)

    if captain_name.nil?
      if golfer && golfer.registration_status != 'cancelled'
        golfer.update!(registration_status: 'cancelled')
        append_audit(golfer, "Team cancelled — captain slot cleared via sponsor portal")
      end
      return
    end

    attrs = {
      name: captain_name,
      email: email,
      phone: captain_slot&.player_phone.presence || 'N/A',
      partner_name: partner_slot&.player_name&.strip.presence,
      partner_email: partner_slot&.player_email&.strip.presence,
      partner_phone: partner_slot&.player_phone&.strip.presence,
      sponsor_id: @sponsor.id,
      sponsor_name: @sponsor.name,
      payment_type: 'sponsor',
      payment_status: 'paid',
      registration_status: 'confirmed',
      is_team_captain: true,
      team_name: expected_team_name,
      company: @sponsor.name,
      paid_at: Time.current,
    }

    if golfer
      changes = detect_changes(golfer, attrs)
      golfer.update!(attrs)
      append_audit(golfer, "Updated via sponsor portal: #{changes}") if changes.present?
      golfer.create_raffle_tickets! rescue nil
    else
      new_golfer = @tournament.golfers.create!(attrs)
      append_audit(new_golfer, "Created via sponsor portal by #{@sponsor.name}")
      new_golfer.create_raffle_tickets! rescue nil
    end
  end

  def captain_email_for(captain_slot, team_number)
    real_email = captain_slot&.player_email&.strip&.downcase.presence
    real_email || "sponsor-#{@sponsor.id}-team#{team_number}@sponsored.local"
  end

  def find_existing_golfer(expected_team_name, email, team_number)
    # Primary: find by the stable team_name + sponsor_id (survives email/name changes)
    golfer = @tournament.golfers.find_by(team_name: expected_team_name, sponsor_id: @sponsor.id)
    return golfer if golfer

    # Fallback: find by email + sponsor_id (for records created before team_name was set)
    golfer = @tournament.golfers.find_by(email: email, sponsor_id: @sponsor.id)
    return golfer if golfer

    # Fallback: check placeholder email
    placeholder = "sponsor-#{@sponsor.id}-team#{team_number}@sponsored.local"
    @tournament.golfers.find_by(email: placeholder, sponsor_id: @sponsor.id) if email != placeholder
  end

  def detect_changes(golfer, attrs)
    tracked = [:name, :email, :phone, :partner_name, :partner_email, :partner_phone]
    changes = tracked.filter_map do |field|
      old_val = golfer.send(field)
      new_val = attrs[field]
      next if old_val.to_s.strip == new_val.to_s.strip
      "#{field}: '#{old_val}' → '#{new_val}'"
    end
    changes.join(', ')
  end

  def append_audit(golfer, message)
    timestamp = Time.current.strftime('%Y-%m-%d %H:%M %Z')
    entry = "[#{timestamp}] #{message}"
    existing = golfer.notes.to_s
    new_notes = existing.present? ? "#{existing}\n#{entry}" : entry
    golfer.update_column(:notes, new_notes)
  end
end
