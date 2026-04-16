const { handleStripeWebhook } = require('../services/stripe-service');
const { publishAlert } = require('../services/sns-service');
const logger = require('../utils/logger');

module.exports = async function webhookStripeRoute(req, res) {
  const signature = req.headers['stripe-signature'];

  try {
    const event = await handleStripeWebhook(req.body, signature, async ({ stripeAccountId, locationId, businessName }) => {
      logger.info('Stripe onboarding complete:', { stripeAccountId, locationId, businessName });

      await publishAlert(
        'Venderly — Stripe Onboarding Complete',
        `Stripe onboarding complete\nBusiness: ${businessName}\nGHL Location: ${locationId}\nStripe Account: ${stripeAccountId}`
      );
    });

    return res.json({ received: true, type: event.type });
  } catch (error) {
    logger.error('Webhook error:', { message: error.message });
    return res.status(400).json({ error: error.message });
  }
};
