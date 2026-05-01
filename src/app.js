const express = require('express');
const healthRoute = require('./routes/health');
const stripeOnboardRoute = require('./routes/stripe-onboard');
const webhookNvaRoute = require('./routes/webhook-nva');
const webhookStripeRoute = require('./routes/webhook-stripe');

const app = express();

// Routes that don't need JSON body parsing
app.get('/health', healthRoute);
app.get('/agency.css', require('./routes/agency-css'));
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), webhookStripeRoute);

// JSON middleware for routes that need it
app.use(express.json());

app.post('/webhook/nva', webhookNvaRoute);
app.post('/stripe/onboard', stripeOnboardRoute);

module.exports = app;