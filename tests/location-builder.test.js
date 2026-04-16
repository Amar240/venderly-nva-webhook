const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLocationPayload } = require('../src/utils/location-builder');

test('buildLocationPayload uses address1 and defaults the country', () => {
  const payload = buildLocationPayload({
    company_name: 'Test Business',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone: '+14155551234',
    address1: '123 Main Street',
    city: 'New York',
    state: 'NY',
    postal_code: '10001'
  }, { companyId: 'company_123' });

  assert.equal(payload.companyId, 'company_123');
  assert.equal(payload.address, '123 Main Street');
  assert.equal(payload.country, 'US');
  assert.equal(payload.timezone, 'America/New_York');
});

test('buildLocationPayload falls back to address when address1 is missing', () => {
  const payload = buildLocationPayload({
    company_name: 'Fallback Test',
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    address: '456 Broadway',
    city: 'Chicago',
    state: 'IL',
    postal_code: '60601'
  }, { companyId: 'company_456' });

  assert.equal(payload.address, '456 Broadway');
  assert.equal(payload.companyId, 'company_456');
});
