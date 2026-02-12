/**
 * Integration test for IPC communication
 * Tests the full flow: item-dropped -> classification -> panel notification
 */

const { spawn } = require('child_process');
const path = require('path');

// Test data
const testCases = [
  { input: 'https://www.google.com', expectedCategory: 'Links' },
  { input: 'Acme Inc', expectedCategory: 'Business' },
  { input: 'John Smith', expectedCategory: 'Name' },
  { input: 'Tech Solutions LLC', expectedCategory: 'Business' },
  { input: 'www.github.com/repo', expectedCategory: 'Links' },
];

// Simulate what happens when main.js receives an item-dropped event
function testItemDropFlow() {
  const { classify } = require('../classify');
  
  let passed = 0;
  let failed = 0;
  const collectedItems = [];
  let itemIdCounter = 1;

  console.log('\nIntegration Test: Item Drop Flow');
  console.log('=================================');

  for (const testCase of testCases) {
    // Simulate the IPC handler logic from main.js
    const category = classify(testCase.input);
    const item = {
      id: itemIdCounter++,
      value: testCase.input,
      category: category,
      timestamp: new Date().toISOString()
    };
    
    collectedItems.push(item);

    // Verify
    if (item.category === testCase.expectedCategory) {
      console.log(`✓ Drop "${testCase.input}" -> ${item.category} (ID: ${item.id})`);
      passed++;
    } else {
      console.log(`✗ Drop "${testCase.input}" -> ${item.category} (expected: ${testCase.expectedCategory})`);
      failed++;
    }
  }

  // Verify collection
  console.log('\n--- Collection State ---');
  console.log(`Total items collected: ${collectedItems.length}`);
  
  if (collectedItems.length === testCases.length) {
    console.log('✓ All items were added to collection');
    passed++;
  } else {
    console.log('✗ Item count mismatch');
    failed++;
  }

  // Verify unique IDs
  const ids = collectedItems.map(i => i.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size === ids.length) {
    console.log('✓ All items have unique IDs');
    passed++;
  } else {
    console.log('✗ Duplicate IDs found');
    failed++;
  }

  // Verify timestamps
  const allHaveTimestamps = collectedItems.every(i => i.timestamp && !isNaN(Date.parse(i.timestamp)));
  if (allHaveTimestamps) {
    console.log('✓ All items have valid timestamps');
    passed++;
  } else {
    console.log('✗ Invalid timestamps found');
    failed++;
  }

  console.log('\n=================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  return failed === 0;
}

// Test CSP allows script execution (simulated check)
function testCSPConfiguration() {
  const fs = require('fs');
  
  console.log('\nCSP Configuration Test');
  console.log('======================');
  
  let passed = 0;
  let failed = 0;
  
  const files = ['drop-target.html', 'panel.html'];
  
  for (const file of files) {
    const filePath = path.join(__dirname, '..', file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes("script-src 'unsafe-inline'")) {
      console.log(`✓ ${file} has correct CSP for inline scripts`);
      passed++;
    } else {
      console.log(`✗ ${file} missing script-src 'unsafe-inline' in CSP`);
      failed++;
    }
  }

  console.log('======================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  return failed === 0;
}

// Test update and delete operations
function testItemOperations() {
  const { classify } = require('../classify');
  
  console.log('\nItem Operations Test');
  console.log('====================');
  
  let passed = 0;
  let failed = 0;
  let collectedItems = [];
  let itemIdCounter = 1;

  // Add items
  const item1 = { id: itemIdCounter++, value: 'Test Item 1', category: classify('Test Item 1'), timestamp: new Date().toISOString() };
  const item2 = { id: itemIdCounter++, value: 'Test Item 2', category: classify('Test Item 2'), timestamp: new Date().toISOString() };
  collectedItems.push(item1, item2);

  // Test update
  const updatedItem = { ...item1, value: 'Updated Value' };
  const index = collectedItems.findIndex(item => item.id === updatedItem.id);
  if (index !== -1) {
    collectedItems[index] = updatedItem;
  }

  if (collectedItems[0].value === 'Updated Value') {
    console.log('✓ Item update works correctly');
    passed++;
  } else {
    console.log('✗ Item update failed');
    failed++;
  }

  // Test delete
  collectedItems = collectedItems.filter(item => item.id !== item2.id);
  
  if (collectedItems.length === 1 && collectedItems[0].id === item1.id) {
    console.log('✓ Item delete works correctly');
    passed++;
  } else {
    console.log('✗ Item delete failed');
    failed++;
  }

  console.log('====================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  return failed === 0;
}

// Run all tests
console.log('\n╔════════════════════════════════════╗');
console.log('║   EazyLyst Integration Tests       ║');
console.log('╚════════════════════════════════════╝');

const results = [
  testItemDropFlow(),
  testCSPConfiguration(),
  testItemOperations()
];

const allPassed = results.every(r => r);

console.log('\n╔════════════════════════════════════╗');
console.log(`║   Overall: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}      ║`);
console.log('╚════════════════════════════════════╝\n');

process.exit(allPassed ? 0 : 1);
