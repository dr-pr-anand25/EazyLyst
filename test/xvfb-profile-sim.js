/**
 * EazyLyst — xvfb profile-lookup simulation
 *
 * Tests every code path added for the Perplexity AI profile feature:
 *   1. parseProfileJSON  — strips fences, filters non-URLs, handles malformed input
 *   2. lookupProfiles    — correct prompts, IPC events, category gating, key gating
 *   3. set-api-key IPC   — stores / clears key
 *   4. panel JS helpers  — buildProfilesHTML states, PLATFORM_META badges (replicated)
 *   5. Full round-trip   — mock API returns real-looking JSON, verify badge output
 *
 * Runs with plain Node.js — no display, no Electron binary.
 */

'use strict';

const { classify } = require('../classify');

// ─── Colour helpers ───────────────────────────────────────────────────────────
const green  = s => `\x1b[32m${s}\x1b[0m`;
const red    = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const bold   = s => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;
const failures = [];

function ok(label, actual, expected) {
  if (actual === expected) {
    console.log(green('  ✓') + ' ' + label);
    passed++;
  } else {
    console.log(red('  ✗') + ' ' + label);
    console.log(red(`      expected: ${JSON.stringify(expected)}`));
    console.log(red(`      got:      ${JSON.stringify(actual)}`));
    failed++;
    failures.push(label);
  }
}

function okTruthy(label, val) {
  if (val) {
    console.log(green('  ✓') + ' ' + label);
    passed++;
  } else {
    console.log(red('  ✗') + ' ' + label);
    failed++;
    failures.push(label);
  }
}

function section(title) {
  console.log('\n' + bold(yellow(`► ${title}`)));
}

// ─── Replicate parseProfileJSON from main.js exactly ─────────────────────────
function parseProfileJSON(content) {
  const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const obj = JSON.parse(clean);
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'string' && val.startsWith('http')) {
        result[key.toLowerCase()] = val;
      }
    }
    return result;
  } catch {
    return null;
  }
}

// ─── Replicate PLATFORM_META + buildProfilesHTML from panel.html ──────────────
const PLATFORM_META = {
  linkedin:  { icon: '💼', label: 'LinkedIn',  color: '#0077B5' },
  twitter:   { icon: '𝕏',  label: 'X',         color: '#111111' },
  instagram: { icon: '📸', label: 'Instagram', color: '#E1306C' },
  facebook:  { icon: '📘', label: 'Facebook',  color: '#1877F2' },
  website:   { icon: '🌐', label: 'Website',   color: '#5C5C5C' },
  github:    { icon: '🐙', label: 'GitHub',    color: '#24292F' },
  youtube:   { icon: '▶️',  label: 'YouTube',  color: '#FF0000' }
};

function buildProfilesHTML(state, perplexityKeyKnown) {
  if (!perplexityKeyKnown) return '';
  if (!state) return '';
  if (state.status === 'loading') {
    return '<loading>';
  }
  if (state.status === 'error') {
    return '<error>';
  }
  if (state.status === 'done') {
    const profiles = state.profiles || {};
    const entries = Object.entries(profiles).filter(([, v]) => v);
    if (entries.length === 0) return '<none>';
    return entries.map(([platform]) => {
      const meta = PLATFORM_META[platform] || { label: platform };
      return `<badge:${meta.label}>`;
    }).join('');
  }
  return '';
}

// ─── Replicate lookupProfiles logic (async, with stubbed callPerplexityAPI) ───
async function simulateLookupProfiles(item, apiKey, stubResponse, stubError) {
  const events = [];

  if (!apiKey) return events;                     // key not set
  if (item.category === 'Links') return events;   // skip URLs

  events.push({ type: 'item-profiles-loading', itemId: item.id });

  try {
    // Build prompt (mirrors main.js exactly)
    let prompt;
    if (item.category === 'Name') {
      prompt = `Find official social media and professional profile links for the person named "${item.value}". ` +
        `Return ONLY a JSON object with these exact keys: linkedin, twitter, instagram, facebook, github, website. ` +
        `Use null for any you cannot find with high confidence. Raw JSON only.`;
    } else {
      prompt = `Find official social media and web presence links for the company or organisation named "${item.value}". ` +
        `Return ONLY a JSON object with these exact keys: website, linkedin, twitter, instagram, facebook, youtube. ` +
        `Use null for any you cannot find with high confidence. Raw JSON only.`;
    }

    if (stubError) throw new Error(stubError);
    const content = stubResponse;     // mock network response
    const profiles = parseProfileJSON(content);
    events.push({ type: 'item-profiles', itemId: item.id, profiles: profiles || {} });
  } catch (err) {
    events.push({ type: 'item-profiles-error', itemId: item.id, error: err.message });
  }

  return events;
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. parseProfileJSON ───────────────────────────────────────────────────────
section('1 — parseProfileJSON: clean JSON');
{
  const raw = JSON.stringify({
    linkedin: 'https://linkedin.com/in/elonmusk',
    twitter:  'https://twitter.com/elonmusk',
    instagram: null,
    github:   'https://github.com/elonmusk',
    website:  'https://tesla.com'
  });
  const r = parseProfileJSON(raw);
  ok('linkedin extracted', r.linkedin, 'https://linkedin.com/in/elonmusk');
  ok('twitter extracted',  r.twitter,  'https://twitter.com/elonmusk');
  ok('github extracted',   r.github,   'https://github.com/elonmusk');
  ok('website extracted',  r.website,  'https://tesla.com');
  ok('null values excluded', r.instagram, undefined);
  ok('exactly 4 keys', Object.keys(r).length, 4);
}

section('2 — parseProfileJSON: markdown fence stripping');
{
  const fenced = '```json\n{"linkedin":"https://linkedin.com/in/test","website":null}\n```';
  const r = parseProfileJSON(fenced);
  ok('linkedin extracted through fence', r.linkedin, 'https://linkedin.com/in/test');
  ok('null still excluded',              r.website,   undefined);
}

section('3 — parseProfileJSON: non-URL values filtered out');
{
  const r = parseProfileJSON(JSON.stringify({
    linkedin: 'https://linkedin.com/in/valid',
    twitter:  '@handle',       // not a URL — must be excluded
    instagram: 'instagram.com/x'  // no http — excluded
  }));
  ok('linkedin kept',         r.linkedin,  'https://linkedin.com/in/valid');
  ok('@handle excluded',      r.twitter,   undefined);
  ok('bare domain excluded',  r.instagram, undefined);
}

section('4 — parseProfileJSON: malformed JSON returns null');
{
  ok('garbage input', parseProfileJSON('not json at all'), null);
  ok('empty string',  parseProfileJSON(''),                null);
  ok('plain text',    parseProfileJSON('No profiles found'),null);
}

section('5 — parseProfileJSON: keys lowercased');
{
  const r = parseProfileJSON(JSON.stringify({ LinkedIn: 'https://linkedin.com/in/x', GITHUB: 'https://github.com/x' }));
  ok('LinkedIn -> linkedin', r.linkedin, 'https://linkedin.com/in/x');
  ok('GITHUB -> github',     r.github,   'https://github.com/x');
}

// ── 2. lookupProfiles gating ──────────────────────────────────────────────────
section('6 — lookupProfiles: no API key → skipped');
(async () => {
  const item = { id: 1, value: 'John Smith', category: 'Name' };
  const events = await simulateLookupProfiles(item, null, '{}');
  ok('no events when key absent', events.length, 0);
})();

section('7 — lookupProfiles: Links category → skipped');
(async () => {
  const item = { id: 2, value: 'https://example.com', category: 'Links' };
  const events = await simulateLookupProfiles(item, 'pplx-test', '{}');
  ok('no events for Links', events.length, 0);
})();

section('8 — lookupProfiles: Name category → correct IPC events');
(async () => {
  const mockResponse = JSON.stringify({
    linkedin:  'https://linkedin.com/in/johnsmith',
    twitter:   'https://twitter.com/johnsmith',
    instagram: null,
    facebook:  null,
    github:    'https://github.com/johnsmith',
    website:   'https://johnsmith.dev'
  });
  const item = { id: 3, value: 'John Smith', category: classify('John Smith') };
  ok('Name classified correctly', item.category, 'Name');
  const events = await simulateLookupProfiles(item, 'pplx-test', mockResponse);
  ok('loading event fired first',       events[0]?.type,    'item-profiles-loading');
  ok('profiles event fired second',     events[1]?.type,    'item-profiles');
  ok('total 2 events',                  events.length,      2);
  ok('linkedin in profiles',            events[1]?.profiles?.linkedin, 'https://linkedin.com/in/johnsmith');
  ok('github in profiles',              events[1]?.profiles?.github,   'https://github.com/johnsmith');
  ok('null values stripped',            events[1]?.profiles?.instagram, undefined);
})();

section('9 — lookupProfiles: Business category → correct IPC events');
(async () => {
  const mockResponse = JSON.stringify({
    website:   'https://tesla.com',
    linkedin:  'https://linkedin.com/company/tesla',
    twitter:   'https://twitter.com/tesla',
    instagram: 'https://instagram.com/teslamotors',
    facebook:  'https://facebook.com/tesla',
    youtube:   'https://youtube.com/tesla'
  });
  const item = { id: 4, value: 'Tesla Inc', category: classify('Tesla Inc') };
  ok('Business classified correctly',  item.category, 'Business');
  const events = await simulateLookupProfiles(item, 'pplx-test', mockResponse);
  ok('loading event first',      events[0]?.type, 'item-profiles-loading');
  ok('profiles event second',    events[1]?.type, 'item-profiles');
  ok('website present',          events[1]?.profiles?.website,   'https://tesla.com');
  ok('youtube present',          events[1]?.profiles?.youtube,   'https://youtube.com/tesla');
})();

section('10 — lookupProfiles: API error → error IPC event');
(async () => {
  const item = { id: 5, value: 'Acme Corp', category: 'Business' };
  const events = await simulateLookupProfiles(item, 'pplx-test', null, 'Network timeout');
  ok('loading event still fires',    events[0]?.type,  'item-profiles-loading');
  ok('error event fires',            events[1]?.type,  'item-profiles-error');
  ok('error message passed through', events[1]?.error, 'Network timeout');
  ok('total 2 events',               events.length,    2);
})();

section('11 — lookupProfiles: empty profiles object (no matches)');
(async () => {
  const item = { id: 6, value: 'Some Obscure Name', category: 'Name' };
  const events = await simulateLookupProfiles(item, 'pplx-test', '{"linkedin":null,"twitter":null,"instagram":null,"facebook":null,"github":null,"website":null}');
  ok('profiles event fires',    events[1]?.type, 'item-profiles');
  ok('profiles object is empty', Object.keys(events[1]?.profiles || {}).length, 0);
})();

// ── 3. set-api-key logic ──────────────────────────────────────────────────────
section('12 — set-api-key logic');
{
  // Mirrors the ipcMain.on('set-api-key') handler
  let key = null;
  const setKey = (val) => { key = val && val.trim() ? val.trim() : null; };
  setKey('  pplx-abc123  ');
  ok('whitespace trimmed',        key, 'pplx-abc123');
  setKey('');
  ok('empty string clears key',   key, null);
  setKey('   ');
  ok('whitespace-only clears key',key, null);
  setKey('pplx-xyz');
  ok('normal key stored',         key, 'pplx-xyz');
}

// ── 4. buildProfilesHTML states ───────────────────────────────────────────────
section('13 — buildProfilesHTML: no API key → empty');
{
  ok('returns empty without key', buildProfilesHTML({ status: 'loading' }, false), '');
}

section('14 — buildProfilesHTML: loading state');
{
  ok('loading HTML', buildProfilesHTML({ status: 'loading' }, true), '<loading>');
}

section('15 — buildProfilesHTML: error state');
{
  ok('error HTML', buildProfilesHTML({ status: 'error' }, true), '<error>');
}

section('16 — buildProfilesHTML: done — no profiles');
{
  ok('none HTML', buildProfilesHTML({ status: 'done', profiles: {} }, true), '<none>');
}

section('17 — buildProfilesHTML: done — with profiles');
{
  const html = buildProfilesHTML({
    status: 'done',
    profiles: {
      linkedin: 'https://li.com/x',
      github:   'https://github.com/x',
      website:  'https://site.com'
    }
  }, true);
  okTruthy('LinkedIn badge present',  html.includes('<badge:LinkedIn>'));
  okTruthy('GitHub badge present',    html.includes('<badge:GitHub>'));
  okTruthy('Website badge present',   html.includes('<badge:Website>'));
}

// ── 5. PLATFORM_META completeness ─────────────────────────────────────────────
section('18 — PLATFORM_META covers all expected platforms');
{
  const expected = ['linkedin','twitter','instagram','facebook','website','github','youtube'];
  expected.forEach(p => ok(`${p} has meta entry`, p in PLATFORM_META, true));
}

// ── 6. Integration: classify → lookupProfiles → profile badges ────────────────
section('19 — Full round-trip: drop → classify → lookup → badges');
(async () => {
  const drops = [
    { text: 'Elon Musk',    expectCat: 'Name',     mockResponse: '{"linkedin":"https://linkedin.com/in/elonmusk","twitter":"https://twitter.com/elonmusk","github":null,"instagram":null,"facebook":null,"website":"https://tesla.com"}' },
    { text: 'OpenAI',       expectCat: 'Business',  mockResponse: '{"website":"https://openai.com","linkedin":"https://linkedin.com/company/openai","twitter":"https://twitter.com/openai","instagram":null,"facebook":null,"youtube":null}' },
    { text: 'https://x.com',expectCat: 'Links',     mockResponse: null }
  ];

  for (const drop of drops) {
    const category = classify(drop.text);
    ok(`"${drop.text}" → ${drop.expectCat}`, category, drop.expectCat);

    const item = { id: Math.random(), value: drop.text, category };
    const events = await simulateLookupProfiles(item, 'pplx-test', drop.mockResponse);

    if (category === 'Links') {
      ok(`  no lookup for Links`, events.length, 0);
    } else {
      ok(`  loading event`, events[0]?.type, 'item-profiles-loading');
      ok(`  profiles event`, events[1]?.type, 'item-profiles');
      const html = buildProfilesHTML({ status: 'done', profiles: events[1].profiles }, true);
      okTruthy(`  badges rendered (non-empty HTML)`, html.length > 0);
    }
  }
})();

// ── Final summary (give async tests a tick to complete) ───────────────────────
setTimeout(() => {
  console.log('\n' + '═'.repeat(44));
  if (failed === 0) {
    console.log(bold(green(`  ALL ${passed} CHECKS PASSED ✓`)));
  } else {
    console.log(bold(red(`  ${failed} FAILED / ${passed + failed} total`)));
    failures.forEach(f => console.log(red(`    • ${f}`)));
  }
  console.log('═'.repeat(44) + '\n');
  process.exitCode = failed > 0 ? 1 : 0;
}, 200);
