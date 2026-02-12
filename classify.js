/**
 * classify.js – Heuristic text classifier for EazyLyst.
 *
 * Categories: "Links", "Business", "Name"
 * Fallback:   "Business"
 */

const BUSINESS_SUFFIXES = [
  'inc', 'llc', 'ltd', 'corp', 'company', 'co', 'plc'
];

const BUSINESS_BLACKLIST = [
  'solutions', 'group', 'systems', 'holdings', 'partners',
  'ventures', 'bank', 'financial', 'services', 'industries', 'enterprises'
];

/**
 * Classify a piece of text into one of three categories.
 * @param {string} value - The raw text or URL.
 * @returns {"Links"|"Business"|"Name"} category
 */
function classify(value) {
  if (typeof value !== 'string') return 'Business';
  const trimmed = value.trim();
  if (!trimmed) return 'Business';

  // 1. Links
  if (/https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    return 'Links';
  }

  const lower = trimmed.toLowerCase();

  // 2. Business blacklist (force Business)
  for (const word of BUSINESS_BLACKLIST) {
    const re = new RegExp('\\b' + word + '\\b', 'i');
    if (re.test(lower)) return 'Business';
  }

  // 3. Business suffixes
  for (const suffix of BUSINESS_SUFFIXES) {
    const re = new RegExp('\\b' + suffix + '\\b', 'i');
    if (re.test(lower)) return 'Business';
  }

  // 4. Name heuristic: 2–3 capitalized words, no blacklist hits
  const words = trimmed.split(/\s+/);
  if (words.length >= 2 && words.length <= 3) {
    const allCapitalized = words.every(w => /^[A-Z][a-z]+$/.test(w));
    if (allCapitalized) return 'Name';
  }

  // 5. Fallback
  return 'Business';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classify };
}
