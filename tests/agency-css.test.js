const { mock, test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const {
  buildGroupCss,
  createAgencyCssRoute,
  formatAccountComment,
  sanitizeCssComment
} = require('../src/routes/agency-css');

function buildTestApp(route) {
  const app = express();
  app.get('/agency.css', route);
  return app;
}

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

test('agencyCssRoute emits global.css before SCHOOL block', async () => {
  const route = createAgencyCssRoute({
    getAllSubaccounts: async () => [{
      locationId: 'abc123',
      cssGroup: 'SCHOOL',
      businessName: 'District One',
      contactEmail: 'admin@example.edu',
      createdAt: '2026-05-01T12:00:00.000Z'
    }],
    routeLogger: {
      info: mock.fn(),
      error: mock.fn(),
      warn: mock.fn()
    },
    s3TextFetcher: async (key) => {
      if (key === 'global.css') return '#global-rule { display: none; }';
      if (key === 'school.css') return '#school-rule { display: none; }';
      throw new Error(`Unexpected S3 key: ${key}`);
    }
  });

  const response = await request(buildTestApp(route))
    .get('/agency.css')
    .expect(200);

  assert.match(response.text, /Global Rules - apply to all Venderly accounts/);
  assert.match(response.text, /#global-rule \{ display: none; \}/);
  assert.match(response.text, /SCHOOL Accounts \(1 total\)/);
  assert.match(response.text, /#school-rule \{ display: none; \}/);
  assert.ok(response.text.indexOf('#global-rule') < response.text.indexOf('SCHOOL Accounts'));
});

test('agencyCssRoute continues when global.css is missing', async () => {
  const routeLogger = {
    info: mock.fn(),
    error: mock.fn(),
    warn: mock.fn()
  };
  const missingGlobalCss = new Error('No such key');
  missingGlobalCss.name = 'NoSuchKey';

  const route = createAgencyCssRoute({
    getAllSubaccounts: async () => [{
      locationId: 'abc123',
      cssGroup: 'SCHOOL',
      businessName: 'District One',
      contactEmail: 'admin@example.edu',
      createdAt: '2026-05-01T12:00:00.000Z'
    }],
    routeLogger,
    s3TextFetcher: async (key) => {
      if (key === 'global.css') throw missingGlobalCss;
      if (key === 'school.css') return '#school-rule { display: none; }';
      throw new Error(`Unexpected S3 key: ${key}`);
    }
  });

  const response = await request(buildTestApp(route))
    .get('/agency.css')
    .expect(200);

  assert.match(response.text, /global\.css not found in S3 — global rules will be missing/);
  assert.match(response.text, /SCHOOL Accounts \(1 total\)/);
  assert.match(response.text, /#school-rule \{ display: none; \}/);
  assert.equal(routeLogger.warn.mock.calls.length, 1);
  assert.deepEqual(routeLogger.warn.mock.calls[0].arguments, [
    'global.css not found in S3 — global rules will be missing'
  ]);
});
