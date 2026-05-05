# GoHighLevel Provisioning

The GoHighLevel provisioning flow is handled by `src/services/ghl-service.js`.

## Inputs used

- `company_name`
- `first_name`
- `last_name`
- `email`
- `phone`
- `address1` or `address`
- `city`
- `state`
- `country`
- `postal_code`

## Environment variables

- `GHL_ACCESS_TOKEN`
- `GHL_COMPANY_ID`

## Notes

- The payload builder now prefers `address1` and falls back to `address`
