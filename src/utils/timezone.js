const ZipcodeToTimezone = require('zipcode-to-timezone');

const DEFAULT_TIMEZONE = 'America/New_York';

function getTimezone(postalCode) {
  if (!postalCode) {
    return DEFAULT_TIMEZONE;
  }

  const zip5 = String(postalCode).replace(/[^0-9]/g, '').slice(0, 5);

  if (!zip5) {
    return DEFAULT_TIMEZONE;
  }

  return ZipcodeToTimezone.lookup(zip5) || DEFAULT_TIMEZONE;
}

module.exports = { DEFAULT_TIMEZONE, getTimezone };
