const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { createWebhookNvaRoute } = require('../src/routes/webhook-nva');

class TestGhlApiError extends Error {}
class TestGhlUserApiError extends Error {
  constructor(message, likelyDuplicate = false) {
    super(message);
    this.likelyDuplicate = likelyDuplicate;
  }
}

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

function buildRouteDependencies(options = {}) {
  const events = [];
  const createLocation = mock.fn(async () => {
    events.push('createLocation');
    return {
      locationId: 'loc_123',
      payload: {},
      result: { id: 'loc_123' }
    };
  });
  const applySnapshot = mock.fn(async () => {
    events.push('applySnapshot');
    return { success: true };
  });
  const createSubAccountUser = mock.fn(options.createSubAccountUser || (async () => {
    events.push('createSubAccountUser');
    return { user: { id: 'user_123' } };
  }));
  const sendStripeUrlToGhl = mock.fn(async () => {
    events.push('sendStripeUrlToGhl');
    return { success: true };
  });
  const publishProvisioningFailure = mock.fn(async () => false);
  const publishAlert = mock.fn(async () => false);
  const saveSubaccountCssGroup = mock.fn(async () => {
    events.push('saveSubaccountCssGroup');
    return 'PRO';
  });
  const createStripeAccount = mock.fn(async () => {
    events.push('createStripeAccount');
    return {
      stripeAccountId: 'acct_123',
      onboardingUrl: 'https://connect.stripe.test/onboard/acct_123'
    };
  });
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
    ghlUserService: {
      GhlUserApiError: TestGhlUserApiError,
      createSubAccountUser
    },
    snsService: { publishAlert, publishProvisioningFailure },
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
    events,
    createLocation,
    applySnapshot,
    createSubAccountUser,
    sendStripeUrlToGhl,
    publishAlert,
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

  assert.equal(deps.createSubAccountUser.mock.calls.length, 1);
  assert.deepEqual(deps.createSubAccountUser.mock.calls[0].arguments[0], {
    locationId: 'loc_123',
    email: 'nia@example.com',
    firstName: 'Nia',
    lastName: 'Patel',
    phone: '+14155550123'
  });
  assert.ok(deps.events.indexOf('applySnapshot') < deps.events.indexOf('createSubAccountUser'));
  assert.ok(deps.events.indexOf('createSubAccountUser') < deps.events.indexOf('saveSubaccountCssGroup'));
  assert.ok(deps.events.indexOf('createSubAccountUser') < deps.events.indexOf('createStripeAccount'));

  assert.equal(deps.saveSubaccountCssGroup.mock.calls.length, 1);
  assert.deepEqual(deps.saveSubaccountCssGroup.mock.calls[0].arguments, [{
    locationId: 'loc_123',
    customerType: 'Small Business',
    businessName: 'Venderly Test Bakery',
    contactEmail: 'nia@example.com'
  }]);

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

  assert.equal(deps.publishAlert.mock.calls.length, 0);
  assert.equal(deps.publishProvisioningFailure.mock.calls.length, 0);
});

test('POST /webhook/nva continues when GHL user creation reports duplicate user', async () => {
  const deps = buildRouteDependencies({
    createSubAccountUser: async () => {
      deps.events.push('createSubAccountUser');
      throw new TestGhlUserApiError('A user with this email already exists.', true);
    }
  });

  const response = await request(deps.app)
    .post('/webhook/nva')
    .send(buildPayload())
    .expect(200);

  assert.deepEqual(response.body, {
    success: true,
    locationId: 'loc_123',
    stripeAccountId: 'acct_123',
    stripeOnboardingUrl: 'https://connect.stripe.test/onboard/acct_123'
  });

  assert.equal(deps.createSubAccountUser.mock.calls.length, 1);
  assert.equal(deps.publishAlert.mock.calls.length, 1);
  assert.match(deps.publishAlert.mock.calls[0].arguments[0], /already exists/);
  assert.match(deps.publishAlert.mock.calls[0].arguments[1], /verify manually/);
  assert.equal(deps.saveSubaccountCssGroup.mock.calls.length, 1);
  assert.equal(deps.createStripeAccount.mock.calls.length, 1);
  assert.ok(deps.events.indexOf('createSubAccountUser') < deps.events.indexOf('saveSubaccountCssGroup'));
  assert.ok(deps.events.indexOf('createSubAccountUser') < deps.events.indexOf('createStripeAccount'));
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
  assert.equal(deps.createSubAccountUser.mock.calls.length, 0);
  assert.equal(deps.saveSubaccountCssGroup.mock.calls.length, 0);
  assert.equal(deps.createStripeAccount.mock.calls.length, 0);
  assert.equal(deps.sendStripeUrlToGhl.mock.calls.length, 0);
  assert.equal(deps.publishAlert.mock.calls.length, 0);
  assert.equal(deps.publishProvisioningFailure.mock.calls.length, 0);
});
