const Stripe = require('stripe');
const { getEnv } = require('../config/env');
const logger = require('../utils/logger');

function getStripeClient() {
  const { stripeSecretKey } = getEnv();

  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }

  return new Stripe(stripeSecretKey);
}

async function createStripeAccount(customerData) {
  const stripe = getStripeClient();
  const { stripeRefreshUrl, stripeReturnUrl } = getEnv();

  logger.info('Creating Stripe account for:', { email: customerData.email });

  const account = await stripe.accounts.create({
    type: 'standard',
    email: customerData.email,
    business_profile: {
      name: customerData.businessName
    },
    metadata: {
      venderly_tenant_id: customerData.locationId || '',
      customer_type: customerData.customerType || ''
    }
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: stripeRefreshUrl,
    return_url: stripeReturnUrl,
    type: 'account_onboarding'
  });

  logger.info('Stripe account created:', { accountId: account.id });
  logger.info('Stripe onboarding link created:', { url: accountLink.url });

  return {
    stripeAccountId: account.id,
    onboardingUrl: accountLink.url
  };
}

function constructStripeEvent(payload, signature) {
  const stripe = getStripeClient();
  const { stripeWebhookSecret } = getEnv();

  if (!stripeWebhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }

  return stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
}

async function handleStripeWebhook(payload, signature, onComplete) {
  const event = constructStripeEvent(payload, signature);

  logger.info('Stripe webhook received:', { type: event.type });

  if (event.type === 'account.updated') {
    const account = event.data.object;

    logger.info('Account updated:', {
      id: account.id,
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted
    });

    if (account.charges_enabled && onComplete) {
      await onComplete({
        stripeAccountId: account.id,
        locationId: account.metadata?.venderly_tenant_id || '',
        businessName: account.business_profile?.name || account.id
      });
    }
  }

  return event;
}

module.exports = {
  constructStripeEvent,
  createStripeAccount,
  handleStripeWebhook
};
