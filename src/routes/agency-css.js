const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { CSS_GROUPS, getAllSubaccounts } = require('../services/css-service');
const { getEnv } = require('../config/env');
const { escapeCssClassSelector } = require('../utils/css-escape');
const logger = require('../utils/logger');

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

async function getS3CssRules(cssGroup) {
  const { awsRegion } = getEnv();
  const client = new S3Client({ region: awsRegion });
  const config = CSS_GROUP_CONFIG[cssGroup];

  if (!config) {
    throw new Error(`Unsupported CSS group: ${cssGroup}`);
  }

  const response = await client.send(new GetObjectCommand({
    Bucket: 'venderly-agency-css',
    Key: config.key
  }));

  return await response.Body.transformToString();
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

module.exports = async function agencyCssRoute(req, res) {
  try {
    // Get all subaccounts from DynamoDB
    const subaccounts = await getAllSubaccounts();

    const groups = {
      [CSS_GROUPS.DELETION]: subaccounts.filter(a => a.cssGroup === CSS_GROUPS.DELETION),
      [CSS_GROUPS.SCHOOL]: subaccounts.filter(a => a.cssGroup === CSS_GROUPS.SCHOOL),
      [CSS_GROUPS.PRO]: subaccounts.filter(a => a.cssGroup === CSS_GROUPS.PRO)
    };

    // Get CSS rules from S3
    const [deletionRules, schoolRules, proRules] = await Promise.all([
      groups[CSS_GROUPS.DELETION].length > 0 ? getS3CssRules(CSS_GROUPS.DELETION) : Promise.resolve(''),
      groups[CSS_GROUPS.SCHOOL].length > 0 ? getS3CssRules(CSS_GROUPS.SCHOOL) : Promise.resolve(''),
      groups[CSS_GROUPS.PRO].length > 0 ? getS3CssRules(CSS_GROUPS.PRO) : Promise.resolve('')
    ]);

    // Generate complete CSS
    let css = '/* Venderly Agency CSS - Generated dynamically */\n\n';
    const generatedAt = new Date();

    css += buildGroupCss(CSS_GROUPS.DELETION, groups[CSS_GROUPS.DELETION], deletionRules, generatedAt);
    css += buildGroupCss(CSS_GROUPS.SCHOOL, groups[CSS_GROUPS.SCHOOL], schoolRules, generatedAt);
    css += buildGroupCss(CSS_GROUPS.PRO, groups[CSS_GROUPS.PRO], proRules, generatedAt);

    logger.info('Agency CSS generated:', { 
      deletionAccounts: groups[CSS_GROUPS.DELETION].length,
      schoolAccounts: groups[CSS_GROUPS.SCHOOL].length,
      proAccounts: groups[CSS_GROUPS.PRO].length
    });

    res.type('text/css')
       .set('Cache-Control', 'public, max-age=120')
       .send(css);

  } catch (error) {
    logger.error('Agency CSS generation failed:', { message: error.message });
    res.status(500).send('/* CSS generation failed */');
  }
};

module.exports.buildGroupCss = buildGroupCss;
module.exports.formatAccountComment = formatAccountComment;
module.exports.formatAccountSelector = formatAccountSelector;
module.exports.formatCreatedDate = formatCreatedDate;
module.exports.formatGeneratedAt = formatGeneratedAt;
module.exports.sanitizeCssComment = sanitizeCssComment;
