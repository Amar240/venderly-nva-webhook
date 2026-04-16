# Stripe Onboarding

The Stripe integration is handled by `src/services/stripe-service.js`.

## Supported flows

- Create a Stripe Connect Standard account
- Generate an onboarding link
- Verify Stripe webhook signatures

## Environment variables

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_REFRESH_URL`
- `STRIPE_RETURN_URL`

## Webhooks

The Stripe webhook route uses `express.raw({ type: 'application/json' })` before JSON parsing so Stripe signature verification can use the original request body.
