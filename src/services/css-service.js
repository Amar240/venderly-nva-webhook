const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { getEnv } = require('../config/env');
const logger = require('../utils/logger');

function getDynamoClient() {
  const { awsRegion } = getEnv();
  const client = new DynamoDBClient({ region: awsRegion });
  return DynamoDBDocumentClient.from(client);
}

function getCssGroup(customerType) {
  if (customerType === 'School (District)') return 'SCHOOL';
  return 'PRO';
}

async function saveSubaccountCssGroup(locationId, customerType) {
  const client = getDynamoClient();
  const cssGroup = getCssGroup(customerType);

  await client.send(new PutCommand({
    TableName: 'venderly-subaccounts',
    Item: { locationId, cssGroup, customerType, createdAt: new Date().toISOString() }
  }));

  logger.info('Saved subaccount CSS group:', { locationId, cssGroup });
  return cssGroup;
}

async function getAllSubaccounts() {
  const client = getDynamoClient();
  const result = await client.send(new ScanCommand({ TableName: 'venderly-subaccounts' }));
  return result.Items || [];
}

module.exports = { saveSubaccountCssGroup, getAllSubaccounts, getCssGroup };