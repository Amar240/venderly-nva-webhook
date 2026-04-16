const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { getEnv } = require('../config/env');
const logger = require('../utils/logger');

let sesClient;

function getSesClient() {
  if (!sesClient) {
    const { awsRegion } = getEnv();
    sesClient = new SESClient({ region: awsRegion });
  }
  return sesClient;
}

function buildEmailHtml(firstName, onboardingUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">Venderly</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1a1a2e;margin:0 0 16px;">Welcome, ${firstName}!</h2>
              <p style="color:#555;line-height:1.6;margin:0 0 16px;">
                Your Venderly account has been created. To start accepting payments, you need to complete your Stripe setup — it only takes a few minutes.
              </p>
              <p style="color:#555;line-height:1.6;margin:0 0 32px;">
                Stripe will ask for some basic business and identity information to verify your account. Once complete, you'll be ready to process transactions.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${onboardingUrl}"
                       style="display:inline-block;background:#635bff;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:6px;font-size:16px;font-weight:bold;">
                      Complete Your Stripe Setup
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#999;font-size:12px;margin:32px 0 0;text-align:center;">
                This link expires in 24 hours. If you need a new link, contact support@venderly.us
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="color:#aaa;font-size:12px;margin:0;">
                &copy; ${new Date().getFullYear()} Venderly &bull; venderly.us
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEmailText(firstName, onboardingUrl) {
  return `Welcome to Venderly, ${firstName}!

Your account has been created. Complete your Stripe setup to start accepting payments:

${onboardingUrl}

This link expires in 24 hours. If you need a new link, contact support@venderly.us

-- Venderly (venderly.us)`;
}

async function sendOnboardingEmail({ toEmail, firstName, onboardingUrl }) {
  const { sesFromEmail } = getEnv();

  const command = new SendEmailCommand({
    Source: sesFromEmail,
    Destination: {
      ToAddresses: [toEmail]
    },
    Message: {
      Subject: {
        Data: 'Complete Your Venderly Stripe Setup',
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: buildEmailHtml(firstName, onboardingUrl),
          Charset: 'UTF-8'
        },
        Text: {
          Data: buildEmailText(firstName, onboardingUrl),
          Charset: 'UTF-8'
        }
      }
    }
  });

  await getSesClient().send(command);
  logger.info('Onboarding email sent:', { to: toEmail });
}

module.exports = { sendOnboardingEmail };
