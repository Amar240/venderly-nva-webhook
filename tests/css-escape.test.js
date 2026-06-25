const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeCssClassSelector } = require('../src/utils/css-escape');

test('escapeCssClassSelector leaves non-digit class selectors unchanged', () => {
  assert.equal(escapeCssClassSelector('abcDEF123'), '.abcDEF123');
});

test('escapeCssClassSelector escapes class selectors that start with a digit', () => {
  assert.equal(escapeCssClassSelector('0HR9Nt'), '.\\30 HR9Nt');
  assert.equal(escapeCssClassSelector('5C0zd13'), '.\\35 C0zd13');
});

test('escapeCssClassSelector returns empty string for empty or missing values', () => {
  assert.equal(escapeCssClassSelector(''), '');
  assert.equal(escapeCssClassSelector(null), '');
  assert.equal(escapeCssClassSelector(undefined), '');
});
