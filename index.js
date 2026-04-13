require('dotenv').config();
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const sns = new SNSClient({ region: 'us-east-2' });
const express = require('express');
const { buildLocationPayload } = require('./location-builder');
const { createStripeAccount, handleStripeWebhook } = require('./stripe-onboarding');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// NVA Webhook — creates GHL subaccount then Stripe account
app.post('/webhook/nva', async (req, res) => {
  try {
    const data = req.body;
    console.log('Received webhook data:', JSON.stringify(data, null, 2));

    // Step 1 — Build and create GHL subaccount
    const locationPayload = buildLocationPayload(data);
    console.log('Built location payload:', JSON.stringify(locationPayload, null, 2));

    const response = await fetch('https://services.leadconnectorhq.com/locations/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify(locationPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMsg = `
        GHL API Error - Sub-account creation failed
        Customer: ${data.first_name} ${data.last_name}
        Email: ${data.email}
        Business: ${data.company_name}
        Error: ${JSON.stringify(result)}
        Time: ${new Date().toISOString()}
      `;
      console.error(errorMsg);

      try {
        await sns.send(new PublishCommand({
          TopicArn: process.env.SNS_TOPIC_ARN,
          Subject: '⚠️ Venderly NVA Failed',
          Message: errorMsg
        }));
      } catch (snsError) {
        console.error('SNS notification failed (non-critical):', snsError.message);
      }

      return res.status(response.status).json({
        success: false,
        error: 'GHL API failed',
        details: result
      });
    }

    console.log('Sub-account created successfully. ID:', result.id);

    // Step 2 — Automatically create Stripe account
    try {
      const stripeResult = await createStripeAccount({
        email: data.email,
        businessName: data.company_name,
        locationId: result.id,
        customerType: data.customer_type,
      });

      console.log('Stripe account created:', stripeResult.stripeAccountId);
      console.log('Onboarding URL:', stripeResult.onboardingUrl);

      res.json({
        success: true,
        locationId: result.id,
        stripeAccountId: stripeResult.stripeAccountId,
        stripeOnboardingUrl: stripeResult.onboardingUrl,
      });

    } catch (stripeError) {
      // Log full Stripe error for debugging
      console.error('Stripe onboarding failed:', JSON.stringify({
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
        param: stripeError.param,
      }, null, 2));

      // GHL succeeded even if Stripe fails — still return success
      res.json({
        success: true,
        locationId: result.id,
        stripeSuccess: false,
        stripeError: stripeError.message,
      });
    }

  } catch (error) {
    console.error('Server error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual Stripe onboard endpoint
app.post('/stripe/onboard', async (req, res) => {
  try {
    const { email, businessName, locationId, customerType } = req.body;

    if (!email || !businessName) {
      return res.status(400).json({ error: 'email and businessName are required' });
    }

    const result = await createStripeAccount({
      email,
      businessName,
      locationId,
      customerType,
    });

    res.json({
      success: true,
      stripeAccountId: result.stripeAccountId,
      onboardingUrl: result.onboardingUrl,
    });

  } catch (error) {
    console.error('Stripe onboarding error:', JSON.stringify({
      message: error.message,
      type: error.type,
      code: error.code,
    }, null, 2));
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook endpoint
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    const event = handleStripeWebhook(req.body, signature);
    res.json({ received: true, type: event.type });
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});