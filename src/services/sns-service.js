const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { getEnv } = require('../config/env');
const logger = require('../utils/logger');

let snsClient;

function getSnsClient() {
  if (!snsClient) {
    const { awsRegion } = getEnv();
    snsClient = new SNSClient({ region: awsRegion });
  }

  return snsClient;
}

async function publishAlert(subject, message) {
  const { snsTopicArn } = getEnv();

  if (!snsTopicArn) {
    logger.info('SNS_TOPIC_ARN is not configured; skipping SNS notification.');
    return false;
  }

  try {
    await getSnsClient().send(new PublishCommand({
      TopicArn: snsTopicArn,
      Subject: subject,
      Message: message
    }));
    return true;
  } catch (error) {
    logger.error('SNS notification failed (non-critical):', { message: error.message });
    return false;
  }
}

// Convenience wrapper kept for backward compatibility
function publishProvisioningFailure(message) {
  return publishAlert('Venderly NVA Failed', message);
}

module.exports = { publishAlert, publishProvisioningFailure };
