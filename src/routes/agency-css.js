const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { CSS_GROUPS, getAllSubaccounts: defaultGetAllSubaccounts } = require('../services/css-service');
const { getEnv } = require('../config/env');
const { escapeCssClassSelector } = require('../utils/css-escape');
const logger = require('../utils/logger');

const CSS_BUCKET = 'venderly-agency-css';
const GLOBAL_CSS_KEY = 'global.css';
const GLOBAL_CSS_MISSING_WARNING = 'global.css not found in S3 — global rules will be missing';

const CSS_GROUP_CONFIG = Object.freeze({
  [CSS_GROUPS.DELETION]: {
    key: 'deletion.css',
    title: 'DELETION Accounts',
    description: 'Deactivated subaccounts'
  },
  [CSS_GROUPS.SCHOOL]: {
    key: 'school.css',
    title: 'SCHOOL Accounts',
    description: 'School subaccounts'
  },
  [CSS_GROUPS.PRO]: {
    key: 'pro.css',
    title: 'PRO Accounts',
    description: 'Professional subaccounts'
  }
});

async function getS3ObjectText(key) {
  const { awsRegion } = getEnv();
  const client = new S3Client({ region: awsRegion });

  const response = await client.send(new GetObjectCommand({
    Bucket: CSS_BUCKET,
    Key: key
  }));

  return await response.Body.transformToString();
}

async function getS3CssRules(cssGroup, s3TextFetcher = getS3ObjectText) {
  const config = CSS_GROUP_CONFIG[cssGroup];

  if (!config) {
    throw new Error(`Unsupported CSS group: ${cssGroup}`);
  }

  return await s3TextFetcher(config.key);
}

function isS3NotFoundError(error) {
  return error?.name === 'NoSuchKey' ||
    error?.name === 'NotFound' ||
    error?.Code === 'NoSuchKey' ||
    error?.Code === 'NotFound' ||
    error?.$metadata?.httpStatusCode === 404;
}

function logWarning(routeLogger, message) {
  if (typeof routeLogger.warn === 'function') {
    routeLogger.warn(message);
    return;
  }

  console.warn(message);
}

async function getGlobalCssRules(s3TextFetcher, routeLogger) {
  try {
    return await s3TextFetcher(GLOBAL_CSS_KEY);
  } catch (error) {
    if (isS3NotFoundError(error)) {
      logWarning(routeLogger, GLOBAL_CSS_MISSING_WARNING);
      return null;
    }

    throw error;
  }
}

function sanitizeCssComment(value) {
  return String(value || '')
    .replace(/\*\//g, '* /')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function formatCreatedDate(createdAt) {
  if (!createdAt) return 'unknown date';

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'unknown date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function formatGeneratedAt(date = new Date()) {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function formatAccountComment(account) {
  const businessName = sanitizeCssComment(account.businessName);
  const contactEmail = sanitizeCssComment(account.contactEmail);

  if (businessName && contactEmail) {
    return `${businessName} - ${contactEmail}`;
  }

  if (businessName) return businessName;
  if (contactEmail) return contactEmail;

  return `(unnamed - created ${formatCreatedDate(account.createdAt)})`;
}

function formatAccountSelector(account, isLast) {
  const selector = escapeCssClassSelector(account.locationId);
  const separator = isLast ? '' : ',';
  return `${selector}${separator} /* ${formatAccountComment(account)} */`;
}

function buildGroupCss(cssGroup, accounts, rules, generatedAt = new Date()) {
  const config = CSS_GROUP_CONFIG[cssGroup];
  if (!config || accounts.length === 0) return '';

  const selectors = accounts
    .map((account, index) => formatAccountSelector(account, index === accounts.length - 1))
    .join('\n');

  return [
    '/* ============================================== */',
    `/* ${config.title} (${accounts.length} total) - ${config.description} */`,
    `/* Generated: ${formatGeneratedAt(generatedAt)} */`,
    '/* ============================================== */',
    '',
    `${selectors} {`,
    rules,
    '}',
    ''
  ].join('\n');
}

function buildGlobalCss(rules) {
  return [
    '/* ============================================== */',
    '/* Global Rules - apply to all Venderly accounts  */',
    '/* Edit via S3: venderly-agency-css/global.css    */',
    '/* ============================================== */',
    '',
    rules === null ? `/* ${GLOBAL_CSS_MISSING_WARNING} */` : rules,
    ''
  ].join('\n');
}

function createAgencyCssRoute(dependencies = {}) {
  const {
    getAllSubaccounts = defaultGetAllSubaccounts,
    routeLogger = logger,
    s3TextFetcher = getS3ObjectText
  } = dependencies;

  return async function agencyCssRoute(req, res) {
    try {
      // Get all subaccounts from DynamoDB
      const subaccounts = await getAllSubaccounts();

      const groups = {
        [CSS_GROUPS.DELETION]: subaccounts.filter(a => a.cssGroup === CSS_GROUPS.DELETION),
        [CSS_GROUPS.SCHOOL]: subaccounts.filter(a => a.cssGroup === CSS_GROUPS.SCHOOL),
        [CSS_GROUPS.PRO]: subaccounts.filter(a => a.cssGroup === CSS_GROUPS.PRO)
      };

      // Get CSS rules from S3
      const [globalRules, deletionRules, schoolRules, proRules] = await Promise.all([
        getGlobalCssRules(s3TextFetcher, routeLogger),
        groups[CSS_GROUPS.DELETION].length > 0 ? getS3CssRules(CSS_GROUPS.DELETION, s3TextFetcher) : Promise.resolve(''),
        groups[CSS_GROUPS.SCHOOL].length > 0 ? getS3CssRules(CSS_GROUPS.SCHOOL, s3TextFetcher) : Promise.resolve(''),
        groups[CSS_GROUPS.PRO].length > 0 ? getS3CssRules(CSS_GROUPS.PRO, s3TextFetcher) : Promise.resolve('')
      ]);

      // Generate complete CSS
      let css = '/* Venderly Agency CSS - Generated dynamically */\n\n';
      const generatedAt = new Date();

      css += buildGlobalCss(globalRules);
      css += buildGroupCss(CSS_GROUPS.DELETION, groups[CSS_GROUPS.DELETION], deletionRules, generatedAt);
      css += buildGroupCss(CSS_GROUPS.SCHOOL, groups[CSS_GROUPS.SCHOOL], schoolRules, generatedAt);
      css += buildGroupCss(CSS_GROUPS.PRO, groups[CSS_GROUPS.PRO], proRules, generatedAt);

      routeLogger.info('Agency CSS generated:', {
        deletionAccounts: groups[CSS_GROUPS.DELETION].length,
        schoolAccounts: groups[CSS_GROUPS.SCHOOL].length,
        proAccounts: groups[CSS_GROUPS.PRO].length
      });

      res.type('text/css')
         .set('Cache-Control', 'public, max-age=120')
         .send(css);

    } catch (error) {
      routeLogger.error('Agency CSS generation failed:', { message: error.message });
      res.status(500).send('/* CSS generation failed */');
    }
  };
}

module.exports = createAgencyCssRoute();
module.exports.createAgencyCssRoute = createAgencyCssRoute;
module.exports.buildGlobalCss = buildGlobalCss;
module.exports.buildGroupCss = buildGroupCss;
module.exports.formatAccountComment = formatAccountComment;
module.exports.formatAccountSelector = formatAccountSelector;
module.exports.formatCreatedDate = formatCreatedDate;
module.exports.formatGeneratedAt = formatGeneratedAt;
module.exports.sanitizeCssComment = sanitizeCssComment;
