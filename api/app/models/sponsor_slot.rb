class SponsorSlot < ApplicationRecord
  belongs_to :sponsor
  belongs_to :tournament

  validates :slot_number, presence: true,
            numericality: { only_integer: true, greater_than: 0 }
  validates :slot_number, uniqueness: { scope: :sponsor_id }
end
