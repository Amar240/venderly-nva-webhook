const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_TIMEZONE, getTimezone } = require('../src/utils/timezone');

test('getTimezone returns the default when postal code is missing', () => {
  assert.equal(getTimezone(), DEFAULT_TIMEZONE);
});

test('getTimezone returns the lookup value for a known ZIP code', () => {
  assert.equal(getTimezone('10001'), 'America/New_York');
});

test('getTimezone falls back when the postal code has no digits', () => {
  assert.equal(getTimezone('ABCDE'), DEFAULT_TIMEZONE);
});
