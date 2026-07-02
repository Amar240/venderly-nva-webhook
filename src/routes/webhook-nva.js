const defaultGhlService = require('../services/ghl-service');
const defaultGhlUserService = require('../services/ghl-user-service');
const defaultSnsService = require('../services/sns-service');
const defaultCssService = require('../services/css-service');
const defaultStripeService = require('../services/stripe-service');
const { SUPPORTED_CUSTOMER_TYPES, getSnapshotId, isSupportedCustomerType } = require('../utils/location-builder');
const logger = require('../utils/logger');

function createWebhookNvaRoute(dependencies = {}) {
  const {
    ghlService = defaultGhlService,
    ghlUserService = defaultGhlUserService,
    snsService = defaultSnsService,
    cssService = defaultCssService,
    stripeService = defaultStripeService,
    snapshotLookup = getSnapshotId,
    customerTypeValidator = isSupportedCustomerType,
    supportedCustomerTypes = SUPPORTED_CUSTOMER_TYPES,
    routeLogger = logger
  } = dependencies;

  const { GhlApiError, createLocation, applySnapshot, formatGhlErrorMessage, sendStripeUrlToGhl } = ghlService;
  const { GhlUserApiError, createSubAccountUser } = ghlUserService;
  const { publishAlert, publishProvisioningFailure } = snsService;
  const { saveSubaccountCssGroup } = cssService;
  const { createStripeAccount } = stripeService;

  return async function webhookNvaRoute(req, res) {
    try {
      const data = req.body;
      routeLogger.info('Received webhook data:', data);

      const customerType = data.customer_type || data.business_type;
      if (!customerType || !customerTypeValidator(customerType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer type',
          details: 'customer_type or business_type must be one of the supported customer types.',
          supportedCustomerTypes
        });
      }

      const { locationId } = await createLocation(data);

      const snapshotId = snapshotLookup(customerType);
      if (snapshotId) {
        try {
          await applySnapshot(locationId, snapshotId);
        } catch (snapErr) {
          routeLogger.error('Snapshot application failed (non-critical):', { message: snapErr.message });
          await publishProvisioningFailure(`Snapshot failed for ${data.company_name} (${locationId}): ${snapErr.message}`);
        }
      }

      // Create GHL user so the customer can log in (non-critical).
      try {
        await createSubAccountUser({
          locationId,
          email: data.email,
          firstName: data.first_name,
          lastName: data.last_name,
          phone: data.phone || ''
        });
        routeLogger.info(`GHL user created for ${data.email} on location ${locationId}`);
      } catch (userErr) {
        routeLogger.error('GHL user creation failed', {
          message: userErr.message,
          email: data.email,
          locationId
        });

        const isDuplicate = GhlUserApiError && userErr instanceof GhlUserApiError && userErr.likelyDuplicate;
        const subject = isDuplicate
          ? `GHL user already exists for ${data.email} on location ${locationId}`
          : `GHL user creation failed for ${data.email} on location ${locationId}`;
        const message = isDuplicate
          ? `A GHL user already exists for ${data.email} on location ${locationId}. They may already have access; verify manually.`
          : `Manual user creation required for ${data.email} on location ${locationId}. Error: ${userErr.message}`;

        await publishAlert(subject, message);
      }

      // Save subaccount CSS group to DynamoDB (non-critical)
      try {
        await saveSubaccountCssGroup({
          locationId,
          customerType,
          businessName: data.company_name || '',
          contactEmail: data.email || ''
        });
      } catch (cssErr) {
        routeLogger.error('CSS group save failed (non-critical):', { message: cssErr.message });
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
            await sendStripeUrlToGhl(data.contactId, data.email, stripeResult.onboardingUrl);
          } catch (contactErr) {
            routeLogger.error('Contact stripe_url update failed (non-critical):', { message: contactErr.message });
          }
        } else {
          routeLogger.info('No contactId in webhook — skipping contact update');
        }

        return res.json({
          success: true,
          locationId,
          stripeAccountId: stripeResult.stripeAccountId,
          stripeOnboardingUrl: stripeResult.onboardingUrl
        });
      } catch (stripeError) {
        routeLogger.error('Stripe onboarding failed:', {
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
      if (GhlApiError && error instanceof GhlApiError) {
        const errorMessage = formatGhlErrorMessage(error.customerData, error.details);
        routeLogger.error(errorMessage);
        await publishProvisioningFailure(errorMessage);
        return res.status(error.status).json({
          success: false,
          error: 'GHL API failed',
          details: error.details
        });
      }

      routeLogger.error('Server error:', { message: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }
  };
}

module.exports = createWebhookNvaRoute();
module.exports.createWebhookNvaRoute = createWebhookNvaRoute;
