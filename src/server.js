require('dotenv').config({ quiet: true });

const app = require('./app');
const { getEnv } = require('./config/env');
const logger = require('./utils/logger');

// Startup environment check — logs var names only, never values
const REQUIRED_VARS = [
  'GHL_ACCESS_TOKEN',
  'GHL_COMPANY_ID',
  'GHL_INBOUND_WEBHOOK_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SNS_TOPIC_ARN',
];

logger.info('Env vars present at startup:', { names: Object.keys(process.env) });

const missingVars = REQUIRED_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  logger.error('Missing required environment variables — shutting down:', { missing: missingVars });
  process.exit(1);
}

logger.info('All required env vars confirmed present.');

const { port } = getEnv();

app.listen(port, '0.0.0.0', () => {
  logger.info(`Server running on port ${port}`);
});
