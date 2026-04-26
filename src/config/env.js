function getEnv() {
  return {
    port: Number(process.env.PORT || 3000),
    awsRegion: process.env.AWS_REGION || 'us-east-2',
    ghlAccessToken: process.env.GHL_ACCESS_TOKEN,
    ghlCompanyId: process.env.GHL_COMPANY_ID,
    ghlInboundWebhookUrl: process.env.GHL_INBOUND_WEBHOOK_URL,
    snsTopicArn: process.env.SNS_TOPIC_ARN,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    stripeRefreshUrl: process.env.STRIPE_REFRESH_URL || 'https://venderly.us/stripe/reauth',
    stripeReturnUrl: process.env.STRIPE_RETURN_URL || 'https://venderly.us/stripe/return'
  };
}

module.exports = { getEnv };
