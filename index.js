require('dotenv').config();
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const sns = new SNSClient({ region: 'us-east-2' });
const express = require('express');
const { buildLocationPayload } = require('./location-builder');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/webhook/nva', async (req, res) => {
  try {
    const data = req.body;
    console.log('Received webhook data:', JSON.stringify(data, null, 2));

    const locationPayload = buildLocationPayload(data);
    console.log('Built location payload:', JSON.stringify(locationPayload, null, 2));

    const response = await fetch('https://services.leadconnectorhq.com/locations/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify(locationPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMsg = `
        GHL API Error - Sub-account creation failed
        Customer: ${data.first_name} ${data.last_name}
        Email: ${data.email}
        Business: ${data.company_name}
        Error: ${JSON.stringify(result)}
        Time: ${new Date().toISOString()}
      `;
      console.error(errorMsg);

      await sns.send(new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: '⚠️ Venderly NVA Failed',
        Message: errorMsg
      }));

      return res.status(response.status).json({ 
        success: false, 
        error: 'GHL API failed', 
        details: result 
      });
    }

    console.log('Sub-account created successfully. ID:', result.id);
    res.json({ success: true, locationId: result.id });

  } catch (error) {
    console.error('Server error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});