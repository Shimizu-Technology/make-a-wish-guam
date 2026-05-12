require "test_helper"

class RaffleDeliveryExceptionTrackingTest < ActiveSupport::TestCase
  setup do
    @tournament = tournaments(:tournament_one)
  end

  test "purchase confirmation SMS marks an existing delivery failed when ClickSend raises" do
    ticket = @tournament.raffle_tickets.create!(
      purchaser_name: "SMS Buyer",
      purchaser_phone: "+16715550123",
      price_cents: 500,
      payment_status: "paid",
      purchased_at: Time.current
    )

    with_singleton_method(ClicksendClient, :configured?, -> { true }) do
      with_singleton_method(ClicksendClient, :send_sms, ->(**) { raise Net::OpenTimeout, "execution expired" }) do
        result = RaffleSmsService.purchase_confirmation(
          tickets: [ ticket ],
          buyer_phone: "+16715550123",
          buyer_name: "SMS Buyer",
          tournament: @tournament
        )

        delivery = MessageDelivery.last
        assert_equal false, result.fetch(:success)
        assert_equal "failed", delivery.status
        assert_equal "raffle_ticket_confirmation", delivery.purpose
        assert_equal "execution expired", delivery.error_text
        assert delivery.failed_at.present?
      end
    end
  end

  test "winner notification SMS marks an existing delivery failed when ClickSend raises" do
    prize = winner_prize

    with_singleton_method(ClicksendClient, :configured?, -> { true }) do
      with_singleton_method(ClicksendClient, :send_sms, ->(**) { raise Net::ReadTimeout, "Net::ReadTimeout" }) do
        result = RaffleSmsService.winner_notification(raffle_prize: prize)

        delivery = MessageDelivery.last
        assert_equal false, result.fetch(:success)
        assert_equal "failed", delivery.status
        assert_equal "raffle_winner_notification", delivery.purpose
        assert_includes delivery.error_text, "Net::ReadTimeout"
        assert delivery.failed_at.present?
      end
    end
  end

  test "raffle email marks an existing delivery failed when Resend raises" do
    previous_key = ENV["RESEND_API_KEY"]
    ENV["RESEND_API_KEY"] = "test_resend_key"

    with_singleton_method(Resend::Emails, :send, ->(*) { raise Timeout::Error, "Resend timeout" }) do
      result = RaffleMailer.new.send(
        :send_email,
        to: "winner@example.com",
        subject: "Winner",
        html: "<p>You won</p>",
        purpose: "raffle_winner_notification",
        tournament: @tournament,
        messageable: winner_prize,
        metadata: {}
      )

      delivery = MessageDelivery.last
      assert_equal false, result.fetch(:success)
      assert_equal "failed", delivery.status
      assert_equal "raffle_winner_notification", delivery.purpose
      assert_equal "Resend timeout", delivery.error_text
      assert delivery.failed_at.present?
    end
  ensure
    ENV["RESEND_API_KEY"] = previous_key
  end

  private

  def winner_prize
    ticket = @tournament.raffle_tickets.create!(
      purchaser_name: "Winner Person",
      purchaser_email: "winner@example.com",
      purchaser_phone: "+16715550123",
      price_cents: 500,
      payment_status: "paid",
      purchased_at: Time.current,
      is_winner: true
    )

    @tournament.raffle_prizes.create!(
      name: "Golf Bag",
      tier: "standard",
      value_cents: 30000,
      won: true,
      won_at: Time.current,
      winning_ticket: ticket,
      winner_name: "Winner Person",
      winner_email: "winner@example.com",
      winner_phone: "+16715550123"
    )
  end

  def with_singleton_method(klass, method_name, replacement)
    original = klass.method(method_name)
    klass.define_singleton_method(method_name, &replacement)
    yield
  ensure
    klass.define_singleton_method(method_name) do |*args, **kwargs, &block|
      original.call(*args, **kwargs, &block)
    end
  end
end
