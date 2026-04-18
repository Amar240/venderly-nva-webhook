const { GhlApiError, createLocation, applySnapshot, formatGhlErrorMessage } = require('../services/ghl-service');
const { publishProvisioningFailure } = require('../services/sns-service');
const { createStripeAccount } = require('../services/stripe-service');
const { sendOnboardingEmail } = require('../services/email-service');
const { getSnapshotId } = require('../utils/location-builder');
const logger = require('../utils/logger');

module.exports = async function webhookNvaRoute(req, res) {
  try {
    const data = req.body;
    logger.info('Received webhook data:', data);

    const { locationId } = await createLocation(data);

    // Handle both field names — NVA form sends business_type, code expects customer_type
    const customerType = data.customer_type || data.business_type;

    // Apply GHL snapshot template (non-critical — failure does not block Stripe)
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
        customerType  // ← fixed — uses the resolved customerType
      });

      // Send onboarding email (non-critical — failure does not block response)
      try {
        await sendOnboardingEmail({
          toEmail: data.email,
          firstName: data.first_name,
          onboardingUrl: stripeResult.onboardingUrl
        });
      } catch (emailErr) {
        logger.error('Email send failed (non-critical):', { message: emailErr.message });
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