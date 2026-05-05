const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { createWebhookNvaRoute } = require('../src/routes/webhook-nva');

class TestGhlApiError extends Error {}

function buildPayload(overrides = {}) {
  return {
    company_name: 'Venderly Test Bakery',
    first_name: 'Nia',
    last_name: 'Patel',
    email: 'nia@example.com',
    phone: '+14155550123',
    address1: '123 Market Street',
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
    postal_code: '94105',
    website: 'https://example.com',
    customer_type: 'Small Business',
    contactId: 'contact_123',
    ...overrides
  };
}

function buildTestApp(route) {
  const app = express();
  app.use(express.json());
  app.post('/webhook/nva', route);
  return app;
}

function buildRouteDependencies() {
  const createLocation = mock.fn(async () => ({
    locationId: 'loc_123',
    payload: {},
    result: { id: 'loc_123' }
  }));
  const applySnapshot = mock.fn(async () => ({ success: true }));
  const sendStripeUrlToGhl = mock.fn(async () => ({ success: true }));
  const publishProvisioningFailure = mock.fn(async () => false);
  const saveSubaccountCssGroup = mock.fn(async () => 'PRO');
  const createStripeAccount = mock.fn(async () => ({
    stripeAccountId: 'acct_123',
    onboardingUrl: 'https://connect.stripe.test/onboard/acct_123'
  }));
  const snapshotLookup = mock.fn((customerType) => {
    const snapshots = {
      'Small Business': 'snap_small_business'
    };
    return snapshots[customerType] || null;
  });

  const route = createWebhookNvaRoute({
    ghlService: {
      GhlApiError: TestGhlApiError,
      createLocation,
      applySnapshot,
      formatGhlErrorMessage: () => 'GHL API failed',
      sendStripeUrlToGhl
    },
    snsService: { publishProvisioningFailure },
    cssService: { saveSubaccountCssGroup },
    stripeService: { createStripeAccount },
    snapshotLookup,
    routeLogger: {
      info: mock.fn(),
      error: mock.fn()
    }
  });

  return {
    app: buildTestApp(route),
    createLocation,
    applySnapshot,
    sendStripeUrlToGhl,
    publishProvisioningFailure,
    saveSubaccountCssGroup,
    createStripeAccount,
    snapshotLookup
  };
}

test('POST /webhook/nva provisions GHL, applies snapshot, and creates Stripe onboarding', async () => {
  const deps = buildRouteDependencies();
  const payload = buildPayload();

  const response = await request(deps.app)
    .post('/webhook/nva')
    .send(payload)
    .expect(200);

  assert.deepEqual(response.body, {
    success: true,
    locationId: 'loc_123',
    stripeAccountId: 'acct_123',
    stripeOnboardingUrl: 'https://connect.stripe.test/onboard/acct_123'
  });

  assert.equal(deps.createLocation.mock.calls.length, 1);
  assert.deepEqual(deps.createLocation.mock.calls[0].arguments[0], payload);

  assert.equal(deps.snapshotLookup.mock.calls.length, 1);
  assert.deepEqual(deps.snapshotLookup.mock.calls[0].arguments, ['Small Business']);

  assert.equal(deps.applySnapshot.mock.calls.length, 1);
  assert.deepEqual(deps.applySnapshot.mock.calls[0].arguments, ['loc_123', 'snap_small_business']);

  assert.equal(deps.saveSubaccountCssGroup.mock.calls.length, 1);
  assert.deepEqual(deps.saveSubaccountCssGroup.mock.calls[0].arguments, ['loc_123', 'Small Business']);

  assert.equal(deps.createStripeAccount.mock.calls.length, 1);
  assert.deepEqual(deps.createStripeAccount.mock.calls[0].arguments[0], {
    email: 'nia@example.com',
    businessName: 'Venderly Test Bakery',
    firstName: 'Nia',
    lastName: 'Patel',
    phone: '+14155550123',
    locationId: 'loc_123',
    customerType: 'Small Business'
  });

  assert.equal(deps.sendStripeUrlToGhl.mock.calls.length, 1);
  assert.deepEqual(deps.sendStripeUrlToGhl.mock.calls[0].arguments, [
    'contact_123',
    'nia@example.com',
    'https://connect.stripe.test/onboard/acct_123'
  ]);

  assert.equal(deps.publishProvisioningFailure.mock.calls.length, 0);
});

test('POST /webhook/nva rejects invalid customer types before external calls', async () => {
  const deps = buildRouteDependencies();

  const response = await request(deps.app)
    .post('/webhook/nva')
    .send(buildPayload({ customer_type: 'Enterprise' }))
    .expect(400);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error, 'Invalid customer type');
  assert.match(response.body.details, /customer_type or business_type/);
  assert.ok(response.body.supportedCustomerTypes.includes('Small Business'));

  assert.equal(deps.createLocation.mock.calls.length, 0);
  assert.equal(deps.snapshotLookup.mock.calls.length, 0);
  assert.equal(deps.applySnapshot.mock.calls.length, 0);
  assert.equal(deps.saveSubaccountCssGroup.mock.calls.length, 0);
  assert.equal(deps.createStripeAccount.mock.calls.length, 0);
  assert.equal(deps.sendStripeUrlToGhl.mock.calls.length, 0);
  assert.equal(deps.publishProvisioningFailure.mock.calls.length, 0);
});
