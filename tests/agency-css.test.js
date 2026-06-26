const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildGroupCss,
  formatAccountComment,
  sanitizeCssComment
} = require('../src/routes/agency-css');

test('formatAccountComment includes business name and email', () => {
  assert.equal(
    formatAccountComment({
      businessName: 'Lincoln Elementary',
      contactEmail: 'admin@lincoln.edu'
    }),
    'Lincoln Elementary - admin@lincoln.edu'
  );
});

test('formatAccountComment falls back to created date for unnamed accounts', () => {
  assert.equal(
    formatAccountComment({
      createdAt: '2026-05-01T12:00:00.000Z'
    }),
    '(unnamed - created May 1, 2026)'
  );
});

test('sanitizeCssComment prevents comments from breaking generated CSS', () => {
  assert.equal(sanitizeCssComment('Bad */ Name\nNext'), 'Bad * / Name Next');
});

test('buildGroupCss emits documented escaped selector list', () => {
  const css = buildGroupCss('SCHOOL', [
    {
      locationId: '0DdNpwmVbVzX4n0GU47Z',
      businessName: 'District One',
      contactEmail: 'admin@example.edu',
      createdAt: '2026-05-01T12:00:00.000Z'
    },
    {
      locationId: 'abc123',
      businessName: '',
      contactEmail: '',
      createdAt: '2026-05-02T12:00:00.000Z'
    }
  ], '#sb_launchpad { display: none; }', new Date('2026-06-24T14:32:00.000Z'));

  assert.match(css, /SCHOOL Accounts \(2 total\)/);
  assert.match(css, /Generated: 2026-06-24 14:32:00 UTC/);
  assert.match(css, /\.\\30 DdNpwmVbVzX4n0GU47Z, \/\* District One - admin@example.edu \*\//);
  assert.match(css, /\.abc123 \/\* \(unnamed - created May 2, 2026\) \*\//);
  assert.match(css, /#sb_launchpad \{ display: none; \}/);
});
