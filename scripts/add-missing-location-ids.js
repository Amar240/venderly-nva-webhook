require('dotenv').config({ quiet: true });
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { getEnv } = require('../src/config/env');
const { CSS_GROUPS, SUBACCOUNTS_TABLE } = require('../src/services/css-service');

const dryRun = process.argv.includes('--dry-run');

const SCHOOL_IDS = [
  '4Iy9VIbeDnHgeKXVBgpR',
  'SwZ8yH1PxIO2O54L2dPj',
  'wBxoZ2AJnSQHSMv311eL',
  '8aqnILCXuVMb78SL9Cwd',
  '0DdNpwmVbVzX4n0GU47Z',
  '2hNRQey4FAzXOR3cuEWA',
  '16lTvLOjys2PSWf5rW3R',
  '4FI8EDi5pNSiDiRjPkE4',
  '1DL8nQZboyp5PgPh6EJo',
  '3deojLrMQY3JubppvjpD',
  '33eqJTGmen4RGiW8E1rk',
  '8ycBDniz3y718OR7vcGC'
];

const PRO_IDS = [
  'jou578AwqxJiVT8wzXcQ',
  '8aqnILCXuVMb78SL9Cwd',
  '2aPEzQXhYw4XQXQod2t7',
  '3CrfdneHuzrTP0p8V284',
  '82DqOuOPixiEwJnCepjl',
  '1M9hszRINwKpQjEmD1ep'
];

function getDynamoClient() {
  const { awsRegion } = getEnv();
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: awsRegion }));
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

async function fetchLocationDetails(locationId) {
  const { ghlAccessToken } = getEnv();

  if (!ghlAccessToken) {
    throw new Error('GHL_ACCESS_TOKEN is not set');
  }

  const response = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${ghlAccessToken}`,
      Accept: 'application/json',
      Version: '2021-07-28'
    }
  });

  const result = await parseResponseBody(response);

  if (response.status === 404) {
    return { deleted: true, details: result };
  }

  if (!response.ok) {
    throw new Error(`GHL location fetch failed (${response.status}): ${JSON.stringify(result)}`);
  }

  return { deleted: false, details: result };
}

function firstString(...values) {
  return values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
}

function extractLocationInfo(responseBody) {
  const location = responseBody.location || responseBody;
  const business = location.business || responseBody.business || {};
  const contact = location.contact || responseBody.contact || {};

  return {
    businessName: firstString(
      business.name,
      location.name,
      responseBody.name,
      location.businessName,
      responseBody.businessName
    ),
    contactEmail: firstString(
      contact.email,
      business.email,
      location.email,
      responseBody.email,
      location.contactEmail,
      responseBody.contactEmail
    )
  };
}

function buildMissingRecords() {
  const records = [];
  const seen = new Set();

  for (const locationId of SCHOOL_IDS) {
    seen.add(locationId);
    records.push({
      locationId,
      cssGroup: CSS_GROUPS.SCHOOL,
      customerType: 'School (District)'
    });
  }

  for (const locationId of PRO_IDS) {
    if (seen.has(locationId)) {
      console.warn(`Warning: ${locationId} appears in both SCHOOL and PRO lists. Keeping SCHOOL; verify manually.`);
      continue;
    }

    seen.add(locationId);
    records.push({
      locationId,
      cssGroup: CSS_GROUPS.PRO,
      customerType: ''
    });
  }

  return records;
}

async function getExistingRecord(client, locationId) {
  const result = await client.send(new GetCommand({
    TableName: SUBACCOUNTS_TABLE,
    Key: { locationId }
  }));

  return result.Item;
}

async function putRecord(client, record) {
  await client.send(new PutCommand({
    TableName: SUBACCOUNTS_TABLE,
    Item: record
  }));
}

async function main() {
  const client = getDynamoClient();
  const records = buildMissingRecords();
  let added = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Adding ${records.length} missing location IDs...`);

  for (const [index, record] of records.entries()) {
    const prefix = `[${index + 1}/${records.length}]`;

    try {
      const existing = await getExistingRecord(client, record.locationId);

      if (existing) {
        skipped++;
        console.log(`${prefix} Skipped locationId=${record.locationId}: already exists with cssGroup=${existing.cssGroup}`);
        continue;
      }

      const result = await fetchLocationDetails(record.locationId);

      if (result.deleted) {
        skipped++;
        console.log(`${prefix} Skipped locationId=${record.locationId}: Account deleted from GHL`);
        continue;
      }

      const info = extractLocationInfo(result.details);
      const item = {
        ...record,
        businessName: info.businessName,
        contactEmail: info.contactEmail,
        createdAt: new Date().toISOString()
      };

      if (dryRun) {
        added++;
        console.log(`${prefix} Would add locationId=${record.locationId} cssGroup=${record.cssGroup}: "${item.businessName}" <${item.contactEmail}>`);
        continue;
      }

      await putRecord(client, item);
      added++;
      console.log(`${prefix} Added locationId=${record.locationId} cssGroup=${record.cssGroup}: "${item.businessName}"`);
    } catch (error) {
      failed++;
      console.error(`${prefix} Failed locationId=${record.locationId}: ${error.message}`);
    }
  }

  console.log(`\n${dryRun ? 'Would add' : 'Added'} ${added}, Skipped ${skipped}, Failed ${failed}`);
}

main().catch(error => {
  console.error('Add missing location IDs failed:', error);
  process.exitCode = 1;
});
