const { getEnv } = require('../config/env');
const { buildLocationPayload } = require('../utils/location-builder');
const logger = require('../utils/logger');

const GHL_LOCATIONS_URL = 'https://services.leadconnectorhq.com/locations/';

class GhlApiError extends Error {
  constructor(status, details, customerData) {
    super('GHL API failed');
    this.name = 'GhlApiError';
    this.status = status;
    this.details = details;
    this.customerData = customerData;
  }
}

async function parseResponseBody(response) {
  const body = await response.text();

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    return { raw: body };
  }
}

function formatGhlErrorMessage(data, details) {
  return `
        GHL API Error - Sub-account creation failed
        Customer: ${data.first_name} ${data.last_name}
        Email: ${data.email}
        Business: ${data.company_name}
        Error: ${JSON.stringify(details)}
        Time: ${new Date().toISOString()}
      `;
}

async function createLocation(data) {
  const { ghlAccessToken, ghlCompanyId } = getEnv();
  const locationPayload = buildLocationPayload(data, { companyId: ghlCompanyId });

  logger.info('Built location payload:', locationPayload);

  const response = await fetch(GHL_LOCATIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ghlAccessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: '2021-07-28'
    },
    body: JSON.stringify(locationPayload)
  });

  const result = await parseResponseBody(response);

  if (!response.ok) {
    throw new GhlApiError(response.status, result, data);
  }

  logger.info('Sub-account created successfully.', { id: result.id });

  return {
    locationId: result.id,
    payload: locationPayload,
    result
  };
}

async function applySnapshot(locationId, snapshotId) {
  const { ghlAccessToken } = getEnv();

  logger.info('Applying snapshot:', { locationId, snapshotId });

  const response = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${ghlAccessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: '2021-07-28'
    },
    body: JSON.stringify({ snapshotId })
  });

  const result = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(`Snapshot apply failed (${response.status}): ${JSON.stringify(result)}`);
  }

  logger.info('Snapshot applied successfully.', { locationId, snapshotId });
  return result;
}

module.exports = {
  GhlApiError,
  createLocation,
  applySnapshot,
  formatGhlErrorMessage
};
