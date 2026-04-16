const express = require('express');
const healthRoute = require('./routes/health');
const stripeOnboardRoute = require('./routes/stripe-onboard');
const webhookNvaRoute = require('./routes/webhook-nva');
const webhookStripeRoute = require('./routes/webhook-stripe');

const app = express();

app.get('/health', healthRoute);
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), webhookStripeRoute);

app.use(express.json());

app.post('/webhook/nva', webhookNvaRoute);
app.post('/stripe/onboard', stripeOnboardRoute);

module.exports = app;
