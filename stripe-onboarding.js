/**
 * stripe-onboarding.js
 * Handles Stripe Connect Standard account creation and onboarding
 * for new Venderly customers after NVA form submission.
 */

async function createStripeAccount(customerData) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  console.log('Creating Stripe account for:', customerData.email);

  // Step 1 — Create Standard account
  const account = await stripe.accounts.create({
    type: 'standard',
    email: customerData.email,
    business_profile: {
      name: customerData.businessName,
    },
    metadata: {
      venderly_tenant_id: customerData.locationId || '',
      customer_type: customerData.customerType || '',
      ghl_location_id: customerData.locationId || '',
    }
  });

  console.log('Stripe account created:', account.id);

  // Step 2 — Prefill person info so customer has less to fill
  if (customerData.firstName && customerData.lastName) {
    await stripe.accounts.persons.create(account.id, {
      first_name: customerData.firstName,
      last_name: customerData.lastName,
      email: customerData.email,
      relationship: { representative: true }
    });
    console.log('Person representative prefilled for:', account.id);
  }

  // Step 3 — Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: 'https://venderly.us/stripe/reauth',
    return_url: 'https://venderly.us/stripe/return',
    type: 'account_onboarding',
  });

  console.log('Onboarding link created:', accountLink.url);

  return {
    stripeAccountId: account.id,
    onboardingUrl: accountLink.url,
  };
}

function handleStripeWebhook(payload, signature) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    throw new Error('Invalid webhook signature');
  }

  console.log('Stripe webhook received:', event.type);

  if (event.type === 'account.updated') {
    const account = event.data.object;
    const ghlLocationId = account.metadata?.ghl_location_id;

    console.log('Account updated:', {
      stripeAccountId: account.id,
      ghlLocationId: ghlLocationId,
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
    });

    if (account.charges_enabled) {
      console.log('✅ KYC complete — Stripe onboarding done for:', account.id);
      console.log('✅ Linked to GHL subaccount:', ghlLocationId);
    }
  }

  return event;
}

module.exports = { createStripeAccount, handleStripeWebhook };