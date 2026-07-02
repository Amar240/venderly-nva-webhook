require('dotenv').config({ quiet: true });
const crypto = require('node:crypto');
const { getEnv } = require('../config/env');

const GHL_USERS_URL = 'https://services.leadconnectorhq.com/users/';
const PASSWORD_LENGTH = 16;
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%&*';
const ALL_PASSWORD_CHARS = `${UPPERCASE}${LOWERCASE}${DIGITS}${SPECIAL}`;

const USER_PERMISSIONS = Object.freeze({
  campaignsEnabled: true,
  campaignsReadOnly: false,
  contactsEnabled: true,
  workflowsEnabled: true,
  workflowsReadOnly: false,
  triggersEnabled: true,
  funnelsEnabled: true,
  websitesEnabled: true,
  opportunitiesEnabled: true,
  dashboardStatsEnabled: true,
  bulkRequestsEnabled: true,
  appointmentsEnabled: true,
  reviewsEnabled: true,
  onlineListingsEnabled: true,
  phoneCallEnabled: true,
  conversationsEnabled: true,
  assignedDataOnly: false,
  adwordsReportingEnabled: true,
  membershipEnabled: true,
  facebookAdsReportingEnabled: true,
  attributionsReportingEnabled: true,
  settingsEnabled: true,
  tagsEnabled: true,
  leadValueEnabled: true,
  marketingEnabled: true,
  agentReportingEnabled: true,
  botService: true,
  socialPlanner: true,
  bloggingEnabled: true,
  invoiceEnabled: true,
  affiliateManagerEnabled: true,
  contentAiEnabled: true,
  refundsEnabled: true,
  recordPaymentEnabled: true,
  cancelSubscriptionEnabled: true,
  paymentsEnabled: true,
  communitiesEnabled: true,
  exportPaymentsEnabled: true
});

class GhlUserApiError extends Error {
  constructor(status, details, { email, locationId, likelyDuplicate = false } = {}) {
    super(`GHL user creation failed (${status})`);
    this.name = 'GhlUserApiError';
    this.status = status;
    this.details = details;
    this.email = email;
    this.locationId = locationId;
    this.likelyDuplicate = likelyDuplicate;
  }
}

function pickRandomChar(chars) {
  return chars[crypto.randomInt(0, chars.length)];
}

function shuffleWithCrypto(chars) {
  const shuffled = [...chars];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.join('');
}

function generateStrongPassword() {
  const chars = [
    pickRandomChar(UPPERCASE),
    pickRandomChar(LOWERCASE),
    pickRandomChar(DIGITS),
    pickRandomChar(SPECIAL)
  ];

  while (chars.length < PASSWORD_LENGTH) {
    chars.push(pickRandomChar(ALL_PASSWORD_CHARS));
  }

  return shuffleWithCrypto(chars);
}

async function parseResponseBody(response) {
  const body = await response.text();
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch (error) {
    return { raw: body };
  }
}

function stringifyDetails(details) {
  if (typeof details === 'string') return details;

  try {
    return JSON.stringify(details);
  } catch (error) {
    return '';
  }
}

function isLikelyDuplicate(status, details) {
  if (status !== 400 && status !== 422) return false;
  return /exist|duplicate|already/i.test(stringifyDetails(details));
}

function requireField(value, fieldName) {
  if (!value) {
    throw new Error(`${fieldName} is required to create a GHL user`);
  }
}

async function createSubAccountUser({ locationId, email, firstName, lastName, phone }) {
  requireField(locationId, 'locationId');
  requireField(email, 'email');
  requireField(firstName, 'firstName');
  requireField(lastName, 'lastName');

  const { ghlAccessToken, ghlCompanyId } = getEnv();
  requireField(ghlAccessToken, 'GHL_ACCESS_TOKEN');
  requireField(ghlCompanyId, 'GHL_COMPANY_ID');

  // GHL requires a password field on create, but this is not the customer's
  // real credential. GHL sends its own activation email where the user sets
  // their own password, so this generated value is never returned or stored.
  const password = generateStrongPassword();
  const userPayload = {
    companyId: ghlCompanyId,
    email,
    password,
    type: 'account',
    role: 'admin',
    locationIds: [locationId],
    firstName,
    lastName,
    permissions: USER_PERMISSIONS
  };

  if (phone) {
    userPayload.phone = phone;
  }

  const response = await fetch(GHL_USERS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ghlAccessToken}`,
      Version: 'v3',
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(userPayload)
  });

  const result = await parseResponseBody(response);

  if (!response.ok) {
    throw new GhlUserApiError(response.status, result, {
      email,
      locationId,
      likelyDuplicate: isLikelyDuplicate(response.status, result)
    });
  }

  return { user: result };
}

module.exports = {
  GhlUserApiError,
  createSubAccountUser,
  generateStrongPassword
};
