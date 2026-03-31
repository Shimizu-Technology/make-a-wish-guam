class BackfillSponsorSlots < ActiveRecord::Migration[8.1]
  def up
    Sponsor.where("slot_count > 0").find_each do |sponsor|
      next unless sponsor.tournament
      existing = sponsor.sponsor_slots.count
      target = sponsor.slot_count.to_i
      if existing < target
        (existing + 1..target).each do |num|
          SponsorSlot.find_or_create_by!(
            sponsor: sponsor,
            tournament: sponsor.tournament,
            slot_number: num
          )
        end
      end
    end
  end

  def down; end
end
