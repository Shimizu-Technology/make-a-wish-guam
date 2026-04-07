# frozen_string_literal: true

require "cgi"

class UserInviteEmailService
  class << self
    def send_invite(user:, invited_by:, role: nil)
      return false unless configured?

      role_label = role == 'volunteer' ? 'volunteer' : 'admin'
      response = Resend::Emails.send(
        {
          from: from_email,
          to: user.email,
          subject: "You're invited to the Make-A-Wish Guam #{role_label == 'volunteer' ? 'team' : 'admin'}",
          html: invite_html(user: user, invited_by: invited_by, role_label: role_label)
        }
      )

      Rails.logger.info("[InviteEmail] sent invite to #{user.email} response=#{response.inspect}")
      true
    rescue StandardError => e
      Rails.logger.error("[InviteEmail] failed for #{user.email}: #{e.class} #{e.message}")
      false
    end

    def configured?
      if ENV["RESEND_API_KEY"].blank?
        Rails.logger.warn("[InviteEmail] RESEND_API_KEY not configured; skipping invite email")
        return false
      end

      if from_email.blank?
        Rails.logger.warn("[InviteEmail] RESEND_FROM_EMAIL/MAILER_FROM_EMAIL missing; skipping invite email")
        return false
      end

      true
    end

    private

    def from_email
      ENV["RESEND_FROM_EMAIL"].presence || ENV["MAILER_FROM_EMAIL"].presence
    end

    def frontend_url
      ENV["FRONTEND_URL"].presence || "http://localhost:5173"
    end

    def escape(value)
      CGI.escapeHTML(value.to_s)
    end

    def invite_html(user:, invited_by:, role_label: 'admin')
      inviter = escape(invited_by&.name.presence || invited_by&.email.presence || "an administrator")
      login_url = escape("#{frontend_url}/admin/login")

      <<~HTML
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Make-A-Wish Admin Invitation</title>
          </head>
          <body style="margin: 0; padding: 0; background: #f0f4f8; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f0f4f8; padding: 24px 12px;">
              <tr>
                <td align="center">
                  <!-- Header -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px;">
                    <tr>
                      <td style="background: #0057B8; border-radius: 16px 16px 0 0; padding: 24px; text-align: center;">
                        <p style="margin: 0 0 4px 0; color: #ffffff; font-size: 24px; font-weight: 800;">
                          &#9733; Make-A-Wish
                        </p>
                        <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600;">
                          Guam &amp; CNMI
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Body -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                    <tr>
                      <td style="padding: 32px 28px;">
                        <h1 style="margin: 0 0 16px 0; color: #0f172a; font-size: 26px; font-weight: 800; text-align: center;">
                          You&#8217;re invited to the #{role_label == 'volunteer' ? 'event team' : 'admin portal'}
                        </h1>

                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.7; color: #475569;">
                          #{inviter} has added you as #{role_label == 'volunteer' ? 'a volunteer' : 'an administrator'} for Make-A-Wish Guam &amp; CNMI.
                          #{role_label == 'volunteer' ? 'You can now help with event check-in and raffle ticket sales.' : 'You can now manage events, registrations, sponsors, and more.'}
                        </p>

                        <!-- Sign-in note -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;">
                          <tr>
                            <td style="padding: 16px 18px;">
                              <p style="margin: 0 0 6px 0; color: #0057B8; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700;">
                                Sign-in note
                              </p>
                              <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #475569;">
                                Create your account using this email address: <strong style="color: #0f172a;">#{escape(user.email)}</strong>.
                                If this is your first time, choose <strong>Sign up</strong> on the login page.
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- CTA Button -->
                        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                          <tr>
                            <td style="border-radius: 12px; background: #0057B8;">
                              <a href="#{login_url}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700;">
                                Open Admin Portal
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b;">
                          Or copy this URL into your browser:
                        </p>
                        <p style="margin: 0 0 24px 0; font-size: 13px; color: #0057B8; word-break: break-all;">
                          #{login_url}
                        </p>

                        <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #94a3b8;">
                          If you already have an account, you can sign in normally.
                          If you were not expecting this invitation, you can ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Footer -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
                    <tr>
                      <td style="padding: 16px 28px; text-align: center;">
                        <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                          Make-A-Wish Guam &amp; CNMI &bull; Events Platform
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      HTML
    end
  end
end
