require('dotenv').config({ quiet: true });
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { getEnv } = require('../src/config/env');
const { SUBACCOUNTS_TABLE } = require('../src/services/css-service');

const dryRun = process.argv.includes('--dry-run');

function getDynamoClient() {
  const { awsRegion } = getEnv();
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: awsRegion }));
}

async function scanSubaccounts(client) {
  const items = [];
  let ExclusiveStartKey;

  do {
    const result = await client.send(new ScanCommand({
      TableName: SUBACCOUNTS_TABLE,
      ExclusiveStartKey
    }));

    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
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

async function updateSubaccount(client, locationId, { businessName, contactEmail }) {
  await client.send(new UpdateCommand({
    TableName: SUBACCOUNTS_TABLE,
    Key: { locationId },
    UpdateExpression: 'SET businessName = :businessName, contactEmail = :contactEmail',
    ExpressionAttributeValues: {
      ':businessName': businessName,
      ':contactEmail': contactEmail
    }
  }));
}

async function main() {
  const client = getDynamoClient();
  const subaccounts = await scanSubaccounts(client);
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Backfilling ${subaccounts.length} subaccounts from GHL...`);

  for (const [index, item] of subaccounts.entries()) {
    const prefix = `[${index + 1}/${subaccounts.length}]`;

    if (item.businessName) {
      skipped++;
      console.log(`${prefix} Skipped locationId=${item.locationId}: businessName already set`);
      continue;
    }

    try {
      const result = await fetchLocationDetails(item.locationId);

      if (result.deleted) {
        skipped++;
        console.log(`${prefix} Skipped locationId=${item.locationId}: Account deleted from GHL`);
        continue;
      }

      const info = extractLocationInfo(result.details);

      if (dryRun) {
        updated++;
        console.log(`${prefix} Would update locationId=${item.locationId}: "${info.businessName}" <${info.contactEmail}>`);
        continue;
      }

      await updateSubaccount(client, item.locationId, info);
      updated++;
      console.log(`${prefix} Updated locationId=${item.locationId}: "${info.businessName}"`);
    } catch (error) {
      failed++;
      console.error(`${prefix} Failed locationId=${item.locationId}: ${error.message}`);
    }
  }

  console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${updated}, Skipped ${skipped}, Failed ${failed}`);
}

main().catch(error => {
  console.error('Backfill failed:', error);
  process.exitCode = 1;
});
