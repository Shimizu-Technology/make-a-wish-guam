# frozen_string_literal: true

# RaffleMailer - uses Resend directly for reliable email delivery
# Note: This is NOT an ActionMailer class - it calls Resend API directly
class RaffleMailer
  include ActionView::Helpers::NumberHelper
  
  class << self
    def winner_email(raffle_prize)
      new.winner_email(raffle_prize)
    end

    def claim_reminder_email(raffle_prize)
      new.claim_reminder_email(raffle_prize)
    end

    def ticket_confirmation_email(raffle_ticket)
      new.ticket_confirmation_email(raffle_ticket)
    end

    def purchase_confirmation_email(tickets:, buyer_email:, buyer_name:, tournament:)
      new.purchase_confirmation_email(tickets: tickets, buyer_email: buyer_email, buyer_name: buyer_name, tournament: tournament)
    end
  end

  def winner_email(raffle_prize)
    @prize = raffle_prize
    @tournament = raffle_prize.tournament
    @organization = @tournament.organization
    @ticket = raffle_prize.winning_ticket
    
    return { error: 'No winner email' } unless @prize.winner_email.present?
    
    set_branding
    
    send_email(
      to: @prize.winner_email,
      subject: "#{@tournament.name} — Congratulations, You Won: #{@prize.name}!",
      html: render_template('raffle_mailer/winner_email')
    )
  end

  def claim_reminder_email(raffle_prize)
    @prize = raffle_prize
    @tournament = raffle_prize.tournament
    @organization = @tournament.organization
    
    return { error: 'No winner email' } unless @prize.winner_email.present?
    
    set_branding
    
    send_email(
      to: @prize.winner_email,
      subject: "Reminder: Claim Your Prize - #{@prize.name}",
      html: render_template('raffle_mailer/claim_reminder_email')
    )
  end

  def ticket_confirmation_email(raffle_ticket)
    @ticket = raffle_ticket
    @tournament = raffle_ticket.tournament
    @organization = @tournament.organization
    @golfer = raffle_ticket.golfer
    
    return { error: 'No golfer email' } unless @golfer&.email.present?
    
    set_branding
    
    send_email(
      to: @golfer.email,
      subject: "Raffle Ticket Confirmed: #{@ticket.ticket_number}",
      html: render_template('raffle_mailer/ticket_confirmation_email')
    )
  end

  def purchase_confirmation_email(tickets:, buyer_email:, buyer_name:, tournament:)
    @tickets = tickets
    @buyer_name = buyer_name
    @buyer_email = buyer_email
    @tournament = tournament
    @organization = tournament.organization
    @total_cents = tickets.sum(&:price_cents)

    return { error: 'No buyer email' } unless buyer_email.present?

    set_branding

    send_email(
      to: buyer_email,
      subject: "#{@tournament.name} — Your Raffle Tickets (#{tickets.size} ticket#{'s' if tickets.size != 1})",
      html: render_purchase_confirmation_html
    )
  end

  private

  def set_branding
    @primary_color = @organization&.primary_color || '#0057B8'
    @org_name = @organization&.name || 'Make-A-Wish Guam & CNMI'
    @logo_url = @organization&.logo_url
  end

  def render_template(template_path)
    view = ActionView::Base.with_empty_template_cache.new(
      ActionView::LookupContext.new(Rails.root.join('app', 'views')),
      {
        prize: @prize,
        ticket: @ticket,
        golfer: @golfer,
        tournament: @tournament,
        organization: @organization,
        primary_color: @primary_color,
        org_name: @org_name,
        logo_url: @logo_url
      },
      nil
    )
    view.render(template: template_path, layout: false)
  end

  def render_purchase_confirmation_html
    brand = @primary_color
    dark_brand = brand.gsub('#', '').tap { |hex|
      break '#000000' unless hex.length == 6 && hex.match?(/\A[0-9A-Fa-f]{6}\z/)
      r = [hex[0..1].to_i(16) * 75 / 100, 0].max
      g = [hex[2..3].to_i(16) * 75 / 100, 0].max
      b = [hex[4..5].to_i(16) * 75 / 100, 0].max
      break "#%02x%02x%02x" % [r, g, b]
    }
    total_dollars = number_to_currency(@total_cents / 100.0)
    ticket_numbers = @tickets.map(&:display_number)

    <<~HTML
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <tr><td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; max-width: 100%;">

            <tr><td style="background: linear-gradient(135deg, #{brand} 0%, #{dark_brand} 100%); padding: 32px 32px 28px; text-align: center;">
              <p style="margin: 0 0 6px; color: rgba(255,255,255,0.75); font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-weight: 600;">#{ERB::Util.html_escape(@org_name)}</p>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Your Raffle Tickets</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">#{ERB::Util.html_escape(@tournament.name)}</p>
            </td></tr>

            <tr><td style="padding: 24px 32px 0;">
              <p style="margin: 0 0 16px; color: #1a1a1a; font-size: 17px; font-weight: 600;">Hi #{ERB::Util.html_escape(@buyer_name)},</p>
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 14px; line-height: 1.65;">
                Thank you for purchasing raffle tickets! Here are your ticket details. Hold on to these — if your number is drawn, you win!
              </p>
            </td></tr>

            <tr><td style="padding: 0 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 12px; margin-bottom: 20px;">
                <tr><td style="padding: 20px;">
                  <p style="margin: 0 0 4px; color: #{brand}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Purchase Summary</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 12px;">
                    <tr>
                      <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Tickets</td>
                      <td style="padding: 4px 0; color: #111827; font-size: 13px; font-weight: 600; text-align: right;">#{@tickets.size}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Total Paid</td>
                      <td style="padding: 4px 0; color: #111827; font-size: 13px; font-weight: 600; text-align: right;">#{total_dollars}</td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td></tr>

            <tr><td style="padding: 0 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 12px; margin-bottom: 20px;">
                <tr><td style="padding: 20px;">
                  <p style="margin: 0 0 12px; color: #{brand}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Your Ticket Numbers</p>
                  <p style="margin: 0; color: #1e3a5f; font-size: 15px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 0.35px; line-height: 1.65;">
                    #{ticket_numbers.map { |n| "##{ERB::Util.html_escape(n)}" }.join('<br>')}
                  </p>
                </td></tr>
              </table>
            </td></tr>

            <tr><td style="padding: 8px 32px 28px;">
              <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                Winners will be notified by email or text. Thank you for supporting <strong style="color: #1a1a1a;">#{ERB::Util.html_escape(@org_name)}</strong>!
              </p>
            </td></tr>

            <tr><td style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 32px; text-align: center;">
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 500;">#{ERB::Util.html_escape(@org_name)}</p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px;">Powered by Shimizu Technology</p>
            </td></tr>

          </table>
        </td></tr>
      </table>
    HTML
  end

  def send_email(to:, subject:, html:)
    return { success: false, error: 'RESEND_API_KEY not configured' } unless resend_configured?
    
    from_email = ENV.fetch("MAILER_FROM_EMAIL", "noreply@shimizu-technology.com")
    
    response = Resend::Emails.send({
      from: from_email,
      to: to,
      subject: subject,
      html: html
    })
    
    parsed = response.respond_to?(:parsed_response) ? response.parsed_response : response
    
    if parsed.is_a?(Hash) && (parsed["statusCode"] || parsed["error"] || parsed[:error])
      error_msg = parsed["message"] || parsed["error"] || parsed[:error] || "Unknown error"
      Rails.logger.error "Raffle email to #{to} failed: #{error_msg}"
      { success: false, error: error_msg }
    else
      Rails.logger.info "Raffle email sent via Resend to #{to}: #{parsed}"
      { success: true, data: parsed }
    end
  rescue => e
    Rails.logger.error "Failed to send raffle email: #{e.message}"
    { success: false, error: e.message }
  end

  def resend_configured?
    if ENV["RESEND_API_KEY"].blank?
      Rails.logger.warn "RESEND_API_KEY not configured - email not sent"
      return false
    end
    true
  end
end
