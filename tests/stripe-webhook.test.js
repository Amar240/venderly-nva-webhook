const test = require('node:test');
const assert = require('node:assert/strict');
const Stripe = require('stripe');
const { constructStripeEvent } = require('../src/services/stripe-service');

test('constructStripeEvent accepts a valid raw webhook payload', () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_example';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_example';

  const payload = JSON.stringify({
    id: 'evt_test_webhook',
    object: 'event',
    type: 'account.updated',
    data: {
      object: {
        id: 'acct_test_123',
        charges_enabled: true,
        details_submitted: true
      }
    }
  });

  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET
  });

  const event = constructStripeEvent(Buffer.from(payload), signature);

  assert.equal(event.type, 'account.updated');
  assert.equal(event.data.object.id, 'acct_test_123');
});

test('constructStripeEvent rejects an invalid signature', () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_example';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_example';

  const payload = Buffer.from(JSON.stringify({
    id: 'evt_invalid_signature',
    object: 'event',
    type: 'account.updated',
    data: {
      object: {
        id: 'acct_invalid'
      }
    }
  }));

  assert.throws(() => constructStripeEvent(payload, 'invalid-signature'));
});
