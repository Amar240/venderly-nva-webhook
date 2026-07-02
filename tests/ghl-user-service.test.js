const { afterEach, mock, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  GhlUserApiError,
  createSubAccountUser,
  generateStrongPassword
} = require('../src/services/ghl-user-service');

const ENV_KEYS = ['GHL_ACCESS_TOKEN', 'GHL_COMPANY_ID'];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
}

function setRequiredEnv() {
  process.env.GHL_ACCESS_TOKEN = 'test_agency_token';
  process.env.GHL_COMPANY_ID = 'company_123';
}

function buildFetchResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
  };
}

async function captureGhlUserError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  assert.fail('Expected createSubAccountUser to throw');
}

afterEach(() => {
  global.fetch = originalFetch;
  restoreEnv();
  mock.restoreAll();
});

test('generateStrongPassword creates a 16-character password with all required classes', () => {
  const password = generateStrongPassword();

  assert.equal(password.length, 16);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[a-z]/);
  assert.match(password, /\d/);
  assert.match(password, /[!@#$%&*]/);
});

test('createSubAccountUser posts to GHL users endpoint with Version v3', async () => {
  setRequiredEnv();
  global.fetch = mock.fn(async () => buildFetchResponse(201, {
    id: 'user_123',
    email: 'nia@example.com'
  }));

  const result = await createSubAccountUser({
    locationId: 'loc_123',
    email: 'nia@example.com',
    firstName: 'Nia',
    lastName: 'Patel',
    phone: '+14155550123'
  });

  assert.deepEqual(result, {
    user: {
      id: 'user_123',
      email: 'nia@example.com'
    }
  });
  assert.equal(result.user.password, undefined);

  assert.equal(global.fetch.mock.calls.length, 1);
  const [url, options] = global.fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://services.leadconnectorhq.com/users/');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, 'Bearer test_agency_token');
  assert.equal(options.headers.Version, 'v3');
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.equal(options.headers.Accept, 'application/json');

  const body = JSON.parse(options.body);
  assert.equal(body.companyId, 'company_123');
  assert.equal(body.email, 'nia@example.com');
  assert.equal(body.type, 'account');
  assert.equal(body.role, 'admin');
  assert.deepEqual(body.locationIds, ['loc_123']);
  assert.equal(body.firstName, 'Nia');
  assert.equal(body.lastName, 'Patel');
  assert.equal(body.phone, '+14155550123');
  assert.equal(body.permissions.campaignsEnabled, true);
  assert.equal(body.permissions.campaignsReadOnly, false);
  assert.equal(body.permissions.workflowsEnabled, true);
  assert.equal(body.permissions.workflowsReadOnly, false);
  assert.equal(body.permissions.assignedDataOnly, false);
  assert.equal(typeof body.password, 'string');
  assert.equal(body.password.length, 16);
});

test('createSubAccountUser throws GhlUserApiError on non-2xx response', async () => {
  setRequiredEnv();
  global.fetch = mock.fn(async () => buildFetchResponse(403, {
    message: 'Forbidden'
  }));

  const error = await captureGhlUserError(createSubAccountUser({
    locationId: 'loc_123',
    email: 'nia@example.com',
    firstName: 'Nia',
    lastName: 'Patel'
  }));

  assert.ok(error instanceof GhlUserApiError);
  assert.equal(error.status, 403);
  assert.deepEqual(error.details, { message: 'Forbidden' });
  assert.equal(error.email, 'nia@example.com');
  assert.equal(error.locationId, 'loc_123');
  assert.equal(error.likelyDuplicate, false);
});

test('createSubAccountUser marks 400 already-exists responses as likely duplicates', async () => {
  setRequiredEnv();
  global.fetch = mock.fn(async () => buildFetchResponse(400, {
    message: 'A user with this email already exists.'
  }));

  const error = await captureGhlUserError(createSubAccountUser({
    locationId: 'loc_123',
    email: 'nia@example.com',
    firstName: 'Nia',
    lastName: 'Patel'
  }));

  assert.ok(error instanceof GhlUserApiError);
  assert.equal(error.status, 400);
  assert.equal(error.likelyDuplicate, true);
});

test('createSubAccountUser marks 422 duplicate responses as likely duplicates', async () => {
  setRequiredEnv();
  global.fetch = mock.fn(async () => buildFetchResponse(422, {
    message: ['duplicate user email']
  }));

  const error = await captureGhlUserError(createSubAccountUser({
    locationId: 'loc_123',
    email: 'nia@example.com',
    firstName: 'Nia',
    lastName: 'Patel'
  }));

  assert.ok(error instanceof GhlUserApiError);
  assert.equal(error.status, 422);
  assert.equal(error.likelyDuplicate, true);
});
