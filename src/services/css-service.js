const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { getEnv } = require('../config/env');
const logger = require('../utils/logger');

const CSS_GROUPS = Object.freeze({
  SCHOOL: 'SCHOOL',
  PRO: 'PRO',
  DELETION: 'DELETION'
});

const VALID_CSS_GROUPS = Object.freeze(Object.values(CSS_GROUPS));
const SUBACCOUNTS_TABLE = 'venderly-subaccounts';

function getDynamoClient() {
  const { awsRegion } = getEnv();
  const client = new DynamoDBClient({ region: awsRegion });
  return DynamoDBDocumentClient.from(client);
}

function isValidCssGroup(cssGroup) {
  return VALID_CSS_GROUPS.includes(cssGroup);
}

function getCssGroup(customerType) {
  if (customerType === 'School (District)') return CSS_GROUPS.SCHOOL;
  return CSS_GROUPS.PRO;
}

function normalizeSaveArgs(input, legacyCustomerType) {
  if (input && typeof input === 'object') {
    return {
      locationId: input.locationId,
      customerType: input.customerType || '',
      businessName: input.businessName || '',
      contactEmail: input.contactEmail || '',
      cssGroup: input.cssGroup
    };
  }

  return {
    locationId: input,
    customerType: legacyCustomerType || '',
    businessName: '',
    contactEmail: '',
    cssGroup: undefined
  };
}

function normalizeSubaccount(item = {}) {
  return {
    ...item,
    businessName: item.businessName || '',
    contactEmail: item.contactEmail || ''
  };
}

async function saveSubaccountCssGroup(input, legacyCustomerType) {
  const client = getDynamoClient();
  const {
    locationId,
    customerType,
    businessName,
    contactEmail,
    cssGroup: requestedCssGroup
  } = normalizeSaveArgs(input, legacyCustomerType);

  if (!locationId) {
    throw new Error('locationId is required to save subaccount CSS group');
  }

  const cssGroup = requestedCssGroup && isValidCssGroup(requestedCssGroup)
    ? requestedCssGroup
    : getCssGroup(customerType);

  await client.send(new PutCommand({
    TableName: SUBACCOUNTS_TABLE,
    Item: {
      locationId,
      cssGroup,
      customerType,
      businessName,
      contactEmail,
      createdAt: new Date().toISOString()
    }
  }));

  logger.info('Saved subaccount CSS group:', { locationId, cssGroup, businessName, contactEmail });
  return cssGroup;
}

async function getAllSubaccounts() {
  const client = getDynamoClient();
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

  return items.map(normalizeSubaccount);
}

module.exports = {
  CSS_GROUPS,
  SUBACCOUNTS_TABLE,
  VALID_CSS_GROUPS,
  getAllSubaccounts,
  getCssGroup,
  getDynamoClient,
  isValidCssGroup,
  normalizeSubaccount,
  saveSubaccountCssGroup
};
