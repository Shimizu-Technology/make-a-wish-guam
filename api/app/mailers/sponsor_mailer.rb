class SponsorMailer < ApplicationMailer
  def access_link(sponsor, token)
    @sponsor = sponsor
    @token = token
    @tournament = sponsor.tournament
    @org = @tournament&.organization
    @primary_color = @org&.primary_color.presence || '#E31837'
    @org_name = @org&.name.presence || 'Make-A-Wish Guam'

    frontend_url = ENV.fetch("FRONTEND_URL", "http://localhost:5173")
    @access_url = "#{frontend_url}/sponsor-portal?token=#{token}"

    mail(
      to: sponsor.login_email,
      subject: "Your Sponsor Portal Access Link — #{@tournament&.name || 'Golf for Wishes'}"
    )
  end
end
