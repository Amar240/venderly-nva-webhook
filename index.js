require('dotenv').config();
const express = require('express');
const { buildLocationPayload } = require('./location-builder');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/webhook/nva', async (req, res) => {
  try {
    const data = req.body;
    console.log('Received webhook data:', JSON.stringify(data, null, 2));

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
      return res.status(response.status).json({ 
        success: false, 
        error: 'GHL API failed', 
        details: result 
      });
    }

    console.log('Sub-account created successfully. ID:', result.id);
    res.json({ success: true, locationId: result.id });

  } catch (error) {
    console.error('Server error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
// ── Stripe Onboarding Routes ──────────────────────────────────────
const { createStripeAccount, handleStripeWebhook } = require('./stripe-onboarding');

// Create Stripe account after GHL subaccount is created
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
    console.error('Stripe onboarding error:', error.message);
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
