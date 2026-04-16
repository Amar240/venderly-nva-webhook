const { createStripeAccount } = require('../services/stripe-service');
const logger = require('../utils/logger');

module.exports = async function stripeOnboardRoute(req, res) {
  try {
    const { email, businessName, firstName, lastName, locationId, customerType } = req.body;

    if (!email || !businessName) {
      return res.status(400).json({ error: 'email and businessName are required' });
    }

    const result = await createStripeAccount({
      email,
      businessName,
      firstName,
      lastName,
      locationId,
      customerType
    });

    return res.json({
      success: true,
      stripeAccountId: result.stripeAccountId,
      onboardingUrl: result.onboardingUrl
    });
  } catch (error) {
    logger.error('Stripe onboarding error:', {
      message: error.message,
      type: error.type,
      code: error.code
    });

    return res.status(500).json({ error: error.message });
  }
};
