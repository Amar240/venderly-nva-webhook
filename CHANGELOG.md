# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-05 — Initial Production Release

First production release. End-to-end provisioning service that turns a customer
form submission into a fully configured GoHighLevel sub-account, a Stripe Connect
onboarding link, and a welcome email — autonomous, no human in the loop.

### Added
- NVA webhook service that creates a GoHighLevel sub-account on customer form
  submission, with snapshot application based on customer type (Small Business,
  Side Hustle, School, Nonprofit, Bank).
- Stripe Connect Standard account creation and onboarding link generation,
  wired directly into the NVA webhook flow.
- GHL Inbound Webhook integration for posting the Stripe URL back to the
  contact record so the welcome-email workflow can fire.
- Stripe `account.updated` webhook handler that publishes an "onboarding
  complete" SNS notification when KYC clears.
- SNS alerting on GHL API failures for operator visibility.
- CSS automation: per-customer-type CSS routing via a DynamoDB lookup and
  S3-stored rule files, served dynamically from `/agency.css`.

### Changed
- Replaced direct GHL contacts API calls with the GHL Inbound Webhook trigger,
  removing the need for the `contacts.write` PIT scope.
- Error log payloads now include customer name, email, and business for
  faster on-call triage.

### Fixed
- Customer type field mapping now accepts both `customer_type` and
  `business_type` from upstream form variants.
- Environment variable loading order; startup now validates required vars
  and exits with a clear message if any are missing.
- Snapshot apply payload structure corrected per GHL support guidance.

### Documentation
- README updated with production status, architecture overview, and reviewer
  quickstart instructions.

### Testing
- Integration test for the full NVA webhook flow added using supertest.
- Negative test for invalid customer types ensures the snapshot picker falls
  back safely when an unknown `customer_type` value is submitted.
- Existing unit tests cover `location-builder`, Stripe webhook signature
  verification, and the timezone helper (9 tests total, all passing).

### Infrastructure
- Dockerfile (`node:20-alpine`) and `.dockerignore` for containerized
  deployment.
- `apprunner.yaml` for AWS App Runner build and run configuration.
- Root `index.js` entry point for App Runner compatibility.
- GitHub Actions CI workflow running `npm ci → npm run check → npm test`
  on every push and pull request.
- Removed orphan duplicate files: a stale `stripe-onboarding.js` at the
  repo root and a duplicate `docs/Process-flow.md`.
