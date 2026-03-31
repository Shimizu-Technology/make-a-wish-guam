class AdminMailer < ApplicationMailer
  helper PhoneHelper

  # Notify admin of new golfer registration (for Pay Later registrations)
  def notify_new_golfer(golfer)
    @golfer = golfer
    @setting = Setting.instance
    @tournament = golfer.tournament
    @entry_fee = calculate_entry_fee(golfer)
    admin_emails = @setting.admin_emails

    return unless admin_emails.any?

    mail(to: admin_emails, subject: "New Golf Tournament Registration: #{golfer.name}")
  end

  # Notify admin of payment received (for manual payments marked by admin - rarely used)
  def notify_payment_received(golfer)
    @golfer = golfer
    @setting = Setting.instance
    @tournament = golfer.tournament
    @entry_fee = calculate_entry_fee(golfer)
    admin_emails = @setting.admin_emails

    return unless admin_emails.any?

    mail(
      to: admin_emails,
      subject: "Payment Received: #{golfer.name}"
    )
  end

  # Combined notification for Stripe payments (registration + payment in one email)
  def notify_new_registration_with_payment(golfer)
    @golfer = golfer
    @setting = Setting.instance
    @tournament = golfer.tournament
    @entry_fee = (@golfer.payment_amount_cents || calculate_entry_fee_cents(golfer)).to_f / 100
    admin_emails = @setting.admin_emails

    return unless admin_emails.any?

    mail(to: admin_emails, subject: "New Registration & Payment: #{golfer.name}")
  end

  # Notify admin when a golfer is registered with a payment link pending
  def notify_new_registration_pending_payment(golfer)
    @golfer = golfer
    @setting = Setting.instance
    @tournament = golfer.tournament
    @entry_fee = calculate_entry_fee(golfer)
    @payment_link = golfer.payment_link_url
    admin_emails = @setting.admin_emails

    return unless admin_emails.any?

    mail(to: admin_emails, subject: "New Registration - Awaiting Payment: #{golfer.name}")
  end

  private

  def calculate_entry_fee(golfer)
    calculate_entry_fee_cents(golfer).to_f / 100
  end

  def calculate_entry_fee_cents(golfer)
    tournament = golfer.tournament
    tournament&.entry_fee || 12500
  end
end
