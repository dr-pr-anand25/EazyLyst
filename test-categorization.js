// Test categorization logic
function categorizeItem(text) {
  const trimmed = text.trim();
  
  // Check for Links (http/https/www)
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) {
    return 'Links';
  }
  
  // Business keywords
  const businessKeywords = [
    'Solutions', 'Group', 'Systems', 'Holdings', 'Partners', 
    'Ventures', 'Bank', 'Financial', 'Services', 'Industries', 
    'Enterprises', 'Inc', 'LLC', 'Ltd', 'Corp', 'Corporation',
    'Company', 'Firm', 'Agency', 'Capital', 'Investment', 
    'Management', 'Consulting'
  ];
  
  const hasBusinessKeyword = businessKeywords.some(keyword => 
    new RegExp(`\\b${keyword}\\b`, 'i').test(trimmed)
  );
  
  if (hasBusinessKeyword) {
    return 'Business';
  }
  
  // Check for Name (2-3 capitalized words)
  const words = trimmed.split(/\s+/);
  if (words.length >= 2 && words.length <= 3) {
    const allCapitalized = words.every(word => /^[A-Z][a-z]+$/.test(word));
    if (allCapitalized) {
      return 'Name';
    }
  }
  
  // Default to Business
  return 'Business';
}

// Test cases
const testCases = [
  { input: 'https://www.google.com', expected: 'Links' },
  { input: 'http://example.com', expected: 'Links' },
  { input: 'www.github.com', expected: 'Links' },
  { input: 'Acme Inc', expected: 'Business' },
  { input: 'Tech Solutions', expected: 'Business' },
  { input: 'Global Holdings LLC', expected: 'Business' },
  { input: 'John Smith', expected: 'Name' },
  { input: 'Jane Doe Wilson', expected: 'Name' },
  { input: 'Bob Builder', expected: 'Name' },
  { input: 'random text', expected: 'Business' },
  { input: 'Some Company', expected: 'Business' }
];

console.log('Testing categorization logic:');
console.log('================================');

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected }) => {
  const result = categorizeItem(input);
  const status = result === expected ? '✓' : '✗';
  if (result === expected) {
    passed++;
  } else {
    failed++;
  }
  console.log(`${status} "${input}" -> ${result} (expected: ${expected})`);
});

console.log('================================');
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed === 0) {
  console.log('\nAll tests passed! ✓');
  process.exit(0);
} else {
  console.log('\nSome tests failed! ✗');
  process.exit(1);
}
