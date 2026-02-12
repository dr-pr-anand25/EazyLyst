/**
 * Tests for classify.js – runs with plain Node.js (no framework needed).
 * Execute:  node test/classify.test.js
 */

const { classify } = require('../classify');

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label} — expected "${expected}", got "${actual}"`);
  }
}

// ── Links ──
assert('http URL',           classify('http://example.com'),           'Links');
assert('https URL',          classify('https://example.com/page'),     'Links');
assert('www prefix',         classify('www.google.com'),               'Links');
assert('mixed case https',   classify('HTTPS://FOO.BAR'),              'Links');

// ── Business suffixes ──
assert('Inc suffix',         classify('Acme Inc'),                     'Business');
assert('LLC suffix',         classify('Widget LLC'),                   'Business');
assert('Ltd suffix',         classify('FooBar Ltd'),                   'Business');
assert('Corp suffix',        classify('MegaCorp Corp'),                'Business');
assert('Company suffix',     classify('The Company'),                  'Business');
assert('Co suffix',          classify('Smith Co'),                     'Business');
assert('PLC suffix',         classify('Global PLC'),                   'Business');

// ── Business blacklist ──
assert('Solutions',          classify('Tech Solutions'),               'Business');
assert('Group',              classify('Alpha Group'),                  'Business');
assert('Holdings',           classify('Beta Holdings'),                'Business');
assert('Bank',               classify('City Bank'),                    'Business');
assert('Financial',          classify('Royal Financial'),              'Business');
assert('Services',           classify('Digital Services'),             'Business');
assert('Industries',         classify('General Industries'),           'Business');
assert('Enterprises',        classify('Stark Enterprises'),            'Business');
assert('Partners',           classify('Global Partners'),              'Business');
assert('Ventures',           classify('New Ventures'),                 'Business');
assert('Systems',            classify('Control Systems'),              'Business');

// ── Name ──
assert('Two-word name',      classify('John Smith'),                   'Name');
assert('Three-word name',    classify('Mary Jane Watson'),             'Name');
assert('Two-word name 2',    classify('Alice Cooper'),                 'Name');

// ── Name rejected (too many words) ──
assert('Four words fallback', classify('One Two Three Four'),          'Business');

// ── Name rejected (lowercase) ──
assert('Lowercase fallback', classify('john smith'),                   'Business');

// ── Fallback ──
assert('Single word',        classify('Hello'),                        'Business');
assert('Empty string',       classify(''),                             'Business');
assert('Non-string',         classify(null),                           'Business');
assert('Numbers only',       classify('12345'),                        'Business');

// ── Summary ──
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed}`);
if (failed > 0) process.exit(1);
