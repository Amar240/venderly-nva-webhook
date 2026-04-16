# Venderly Provisioning Finance Automation

## Overview

This repository contains a small Node.js service that:

- receives NVA customer webhook submissions
- creates a GoHighLevel sub-account for the customer
- starts Stripe Connect onboarding
- accepts Stripe webhook callbacks

The codebase is intentionally simple and student-friendly: Express routes in `src/routes/`, integration logic in `src/services/`, and small helpers in `src/utils/`.

## Project Structure

```text
src/
  config/    environment loading
  routes/    Express handlers
  services/  GHL, Stripe, SNS integrations
  utils/     logger, timezone lookup, payload builder
tests/       node:test coverage for core helpers
docs/        project notes and API flow
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in the required secrets locally. Do not commit `.env`.

4. Start the service:

   ```bash
   npm start
   ```

The server listens on `PORT` and defaults to `3000`.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Local server port |
| `AWS_REGION` | AWS region for SNS |
| `SNS_TOPIC_ARN` | Optional SNS topic for GHL failure alerts |
| `GHL_ACCESS_TOKEN` | GoHighLevel API bearer token |
| `GHL_COMPANY_ID` | GoHighLevel company ID |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_REFRESH_URL` | Stripe onboarding refresh URL |
| `STRIPE_RETURN_URL` | Stripe onboarding return URL |

## HTTP Endpoints

- `GET /health`
- `POST /webhook/nva`
- `POST /stripe/onboard`
- `POST /webhook/stripe`

## Developer Commands

```bash
npm run check
npm test
npm start
```

## Notes

- `POST /webhook/stripe` uses raw-body parsing so Stripe signature verification works correctly.
- The GoHighLevel payload builder prefers `address1` and falls back to `address`.
- Snapshot mapping was removed because it was not part of the accepted GoHighLevel location payload.
