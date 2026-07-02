# Process Flow

This document describes the production NVA provisioning flow for the AI Debug Assistant.

## `POST /webhook/nva`

1. Receive the NVA webhook payload.
2. Validate `customer_type` or `business_type`.
3. Create the GoHighLevel sub-account with `POST /locations/` and `Version: 2021-07-28`.
4. Apply the customer-type snapshot with `PUT /locations/{id}` and `Version: 2021-07-28`.
5. Create the GoHighLevel user with `POST /users/` and `Version: v3`.
   - This is a deliberate exception to the normal GHL API version used elsewhere.
   - The Create User endpoint requires `Version: v3`.
   - User creation is a soft-failure step; CSS and Stripe continue if it fails.
6. Save the sub-account CSS group to DynamoDB.
7. Create the Stripe Connect account and onboarding link.
8. Send the Stripe onboarding URL back to GoHighLevel through the inbound webhook.

## GHL User Creation Failure Modes

- `400` with an already-exists message: `likelyDuplicate = true`; send SNS alert and continue.
- `401`: agency token is invalid or expired; send SNS alert and continue.
- `403`: agency token lacks permission; send SNS alert and continue.
- `422`: request validation failed; send SNS alert and continue.
- Network error: send SNS alert and continue.

All GHL user creation failures are soft failures. The customer can still continue the Stripe onboarding flow while Ryan manually repairs the GHL user access.

## CloudWatch Search Patterns

- `GHL user creation failed`
- `GHL user already exists`
- `GHL user created for`

## Manual Recovery

1. Go to GHL Agency.
2. Open Settings -> Team.
3. Find the affected location and manually add the user as ACCOUNT-ADMIN.
4. Alternative path: open the sub-account, then Settings -> My Staff -> Add User.
