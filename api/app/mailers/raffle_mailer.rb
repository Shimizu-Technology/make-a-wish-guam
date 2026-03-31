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
      subject: "🎉 Congratulations! You Won: #{@prize.name}",
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

  private

  def set_branding
    @primary_color = @organization&.primary_color || '#1e40af'
    @org_name = @organization&.name || 'Pacific Golf'
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

  def send_email(to:, subject:, html:)
    return { error: 'RESEND_API_KEY not configured' } unless resend_configured?
    
    from_email = ENV.fetch("MAILER_FROM_EMAIL", "noreply@shimizu-technology.com")
    
    response = Resend::Emails.send({
      from: from_email,
      to: to,
      subject: subject,
      html: html
    })
    
    Rails.logger.info "Raffle email sent via Resend to #{to}: #{response.parsed_response}"
    response.parsed_response
  rescue => e
    Rails.logger.error "Failed to send raffle email: #{e.message}"
    { error: e.message }
  end

  def resend_configured?
    if ENV["RESEND_API_KEY"].blank?
      Rails.logger.warn "RESEND_API_KEY not configured - email not sent"
      return false
    end
    true
  end
end
