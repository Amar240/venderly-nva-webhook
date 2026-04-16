# API Flow

## `GET /health`

Returns a simple JSON response:

```json
{ "status": "ok" }
```

## `POST /webhook/nva`

Accepts an NVA customer submission, provisions the GoHighLevel location, and then attempts Stripe onboarding.

## `POST /stripe/onboard`

Creates a Stripe Connect Standard onboarding link for an existing customer record.

## `POST /webhook/stripe`

Accepts raw Stripe webhook payloads and verifies the Stripe signature before processing the event.
