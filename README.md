# Venderly Provisioning Finance Automation

## Overview

This repository contains a small Node.js service that:

- receives NVA customer webhook submissions
- creates a GoHighLevel sub-account for the customer
- starts Stripe Connect onboarding
- accepts Stripe webhook callbacks

The codebase is intentionally simple and student-friendly: Express routes in `src/routes/`, integration logic in `src/services/`, and small helpers in `src/utils/`.

## Production Status

Service deployed on AWS App Runner: https://tn4e9g7353.us-east-2.awsapprunner.com

Live since January 2026.

Currently provisioning 67+ customer sub-accounts in production.

Snapshots are applied during provisioning through the active GoHighLevel location flow.

## Architecture

Single Express service deployed on AWS App Runner that orchestrates:

- GoHighLevel sub-account creation (with snapshot template applied per customer type)
- Stripe Connect onboarding link generation
- DynamoDB-backed dynamic CSS theming for sub-accounts
- SNS error alerting (downstream consumed by AI Debug Assistant)

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

## Quickstart for Reviewers

To verify the codebase without AWS access:

```bash
git clone https://github.com/Amar240/venderly-nva-webhook
cd venderly-nva-webhook
npm install
npm test       # 9 tests, no AWS required
npm run check  # lint + format check, no AWS required
```

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
