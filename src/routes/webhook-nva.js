const { GhlApiError, createLocation, applySnapshot, formatGhlErrorMessage, sendStripeUrlToGhl } = require('../services/ghl-service');
const { publishProvisioningFailure } = require('../services/sns-service');
const { createStripeAccount } = require('../services/stripe-service');
const { getSnapshotId } = require('../utils/location-builder');
const logger = require('../utils/logger');

module.exports = async function webhookNvaRoute(req, res) {
  try {
    const data = req.body;
    logger.info('Received webhook data:', data);

    const { locationId } = await createLocation(data);

    const customerType = data.customer_type || data.business_type;

    const snapshotId = getSnapshotId(customerType);
    if (snapshotId) {
      try {
        await applySnapshot(locationId, snapshotId);
      } catch (snapErr) {
        logger.error('Snapshot application failed (non-critical):', { message: snapErr.message });
        await publishProvisioningFailure(`Snapshot failed for ${data.company_name} (${locationId}): ${snapErr.message}`);
      }
    }

    try {
      const stripeResult = await createStripeAccount({
        email: data.email,
        businessName: data.company_name,
        firstName: data.first_name,
        lastName: data.last_name,
        phone: data.phone,
        locationId,
        customerType
      });

      // Update GHL contact with Stripe onboarding URL (non-critical)
      if (data.contactId) {
        try {
          await sendStripeUrlToGhl(data.contactId, stripeResult.onboardingUrl);
        } catch (contactErr) {
          logger.error('Contact stripe_url update failed (non-critical):', { message: contactErr.message });
        }
      } else {
        logger.info('No contactId in webhook — skipping contact update');
      }

      return res.json({
        success: true,
        locationId,
        stripeAccountId: stripeResult.stripeAccountId,
        stripeOnboardingUrl: stripeResult.onboardingUrl
      });
    } catch (stripeError) {
      logger.error('Stripe onboarding failed:', {
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
        param: stripeError.param
      });

      return res.json({
        success: true,
        locationId,
        stripeSuccess: false,
        stripeError: stripeError.message
      });
    }
  } catch (error) {
    if (error instanceof GhlApiError) {
      const errorMessage = formatGhlErrorMessage(error.customerData, error.details);
      logger.error(errorMessage);
      await publishProvisioningFailure(errorMessage);
      return res.status(error.status).json({
        success: false,
        error: 'GHL API failed',
        details: error.details
      });
    }

    logger.error('Server error:', { message: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
};
