# frozen_string_literal: true

class RaffleSaleBatch < ApplicationRecord
  belongs_to :tournament
  belongs_to :sold_by_user, class_name: "User", optional: true
  has_many :raffle_tickets, dependent: :nullify

  def payment_method_label
    case payment_method
    when "stripe" then "Stripe"
    when "swipe_simple", "swipesimple", "swipe_simple_confirmed" then "SwipeSimple"
    when "pay_on_day" then "Pay on Day"
    when "walk_in" then "Walk-in"
    when "cash" then "Cash"
    when "check" then "Check"
    when "card", "credit" then "Card"
    when "comp" then "Comp"
    when nil, "" then nil
    else payment_method.to_s.humanize
    end
  end
end
