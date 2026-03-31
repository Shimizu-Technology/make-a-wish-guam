class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("MAILER_FROM_EMAIL", "noreply@airportgolf.com")
  layout "mailer"
  helper MailerHelper

  private

  def set_org_branding
    org = @golfer&.tournament&.organization
    @primary_color = org&.primary_color.presence || '#1e40af'
    @org_name = org&.name.presence || 'Pacific Golf'
    @org_logo_url = org&.logo_url
  end
end
