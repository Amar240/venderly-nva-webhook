# Architecture

This service is a small Express application that provisions a GoHighLevel location from an NVA webhook and then starts optional Stripe Connect onboarding.

## Layout

- `src/app.js` wires middleware and HTTP routes
- `src/routes/` contains one handler per endpoint
- `src/services/` owns external integrations such as GoHighLevel, Stripe, and SNS
- `src/utils/` holds reusable helpers for logging, timezone lookup, and payload shaping
- `src/config/env.js` centralizes environment variable access

## Runtime flow

1. NVA posts customer data to `POST /webhook/nva`
2. The app builds a GoHighLevel location payload and creates the sub-account
3. If GHL succeeds, the app attempts Stripe Connect onboarding
4. If GHL fails, the app can publish a non-fatal SNS notification
