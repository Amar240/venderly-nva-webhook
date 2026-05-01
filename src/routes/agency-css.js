const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getAllSubaccounts } = require('../services/css-service');
const { getEnv } = require('../config/env');
const logger = require('../utils/logger');

async function getS3CssRules(cssGroup) {
  const { awsRegion } = getEnv();
  const client = new S3Client({ region: awsRegion });
  const key = cssGroup === 'SCHOOL' ? 'school.css' : 'pro.css';

  const response = await client.send(new GetObjectCommand({
    Bucket: 'venderly-agency-css',
    Key: key
  }));

  return await response.Body.transformToString();
}

module.exports = async function agencyCssRoute(req, res) {
  try {
    // Get all subaccounts from DynamoDB
    const subaccounts = await getAllSubaccounts();

    // Group by cssGroup
    const schoolIds = subaccounts
      .filter(a => a.cssGroup === 'SCHOOL')
      .map(a => `.${a.locationId}`);

    const proIds = subaccounts
      .filter(a => a.cssGroup === 'PRO')
      .map(a => `.${a.locationId}`);

    // Get CSS rules from S3
    const [schoolRules, proRules] = await Promise.all([
      schoolIds.length > 0 ? getS3CssRules('SCHOOL') : Promise.resolve(''),
      proIds.length > 0 ? getS3CssRules('PRO') : Promise.resolve('')
    ]);

    // Generate complete CSS
    let css = '/* Venderly Agency CSS - Generated dynamically */\n\n';

    if (schoolIds.length > 0) {
      css += `/* SCHOOL accounts */\n${schoolIds.join(',\n')} {\n${schoolRules}\n}\n\n`;
    }

    if (proIds.length > 0) {
      css += `/* PRO accounts */\n${proIds.join(',\n')} {\n${proRules}\n}\n\n`;
    }

    logger.info('Agency CSS generated:', { 
      schoolAccounts: schoolIds.length, 
      proAccounts: proIds.length 
    });

    res.type('text/css')
       .set('Cache-Control', 'public, max-age=120')
       .send(css);

  } catch (error) {
    logger.error('Agency CSS generation failed:', { message: error.message });
    res.status(500).send('/* CSS generation failed */');
  }
};