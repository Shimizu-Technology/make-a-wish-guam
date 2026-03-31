# frozen_string_literal: true

# TournamentMailer - uses Resend directly for reliable email delivery
# Note: This is NOT an ActionMailer class - it calls Resend API directly
class TournamentMailer
  include ActionView::Helpers::NumberHelper
  
  class << self
    # Send reminder email 1 day before tournament
    def reminder_email(golfer)
      new.reminder_email(golfer)
    end

    # Send day-of instructions on tournament morning
    def day_of_email(golfer)
      new.day_of_email(golfer)
    end

    # Send results summary after tournament completion
    def results_email(golfer, results_data = {})
      new.results_email(golfer, results_data)
    end
  end

  def reminder_email(golfer)
    @golfer = golfer
    @tournament = golfer.tournament
    @organization = @tournament.organization
    
    set_branding
    
    send_email(
      to: golfer.email,
      subject: "Reminder: #{@tournament.name} is Tomorrow!",
      html: render_template('tournament_mailer/reminder_email')
    )
  end

  def day_of_email(golfer)
    @golfer = golfer
    @tournament = golfer.tournament
    @organization = @tournament.organization
    
    set_branding
    
    send_email(
      to: golfer.email,
      subject: "Today's the Day! #{@tournament.name} Instructions",
      html: render_template('tournament_mailer/day_of_email')
    )
  end

  def results_email(golfer, results_data = {})
    @golfer = golfer
    @tournament = golfer.tournament
    @organization = @tournament.organization
    @results = results_data
    
    set_branding
    
    send_email(
      to: golfer.email,
      subject: "Results: #{@tournament.name}",
      html: render_template('tournament_mailer/results_email')
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
        golfer: @golfer,
        tournament: @tournament,
        organization: @organization,
        primary_color: @primary_color,
        org_name: @org_name,
        logo_url: @logo_url,
        results: @results
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
    
    Rails.logger.info "Tournament email sent via Resend to #{to}: #{response.parsed_response}"
    response.parsed_response
  rescue => e
    Rails.logger.error "Failed to send tournament email: #{e.message}"
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
