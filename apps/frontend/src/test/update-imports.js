#!/usr/bin/env node

/**
 * Script to help identify and update test utility imports
 * This script scans for old import patterns and suggests replacements
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Define import patterns to find and replace
const IMPORT_PATTERNS = [
  {
    pattern: /from ['"]@\/test\/test-utils['"]/g,
    replacement: "from '@/test'",
    description: "Replace test-utils imports with unified index"
  },
  {
    pattern: /from ['"]@\/test\/enhanced-test-utils['"]/g,
    replacement: "from '@/test'",
    description: "Replace enhanced-test-utils imports with unified index"
  },
  {
    pattern: /from ['"]@\/test\/enhanced-setup['"]/g,
    replacement: "from '@/test'",
    description: "Replace enhanced-setup imports with unified index"
  },
  {
    pattern: /from ['"]@\/test\/enhanced-test-setup['"]/g,
    replacement: "from '@/test'",
    description: "Replace enhanced-test-setup imports with unified index"
  },
  {
    pattern: /from ['"]@\/test\/optimized-setup['"]/g,
    replacement: "from '@/test'",
    description: "Replace optimized-setup imports with unified index"
  },
  {
    pattern: /from ['"]@\/test\/enhanced-hook-mocks['"]/g,
    replacement: "from '@/test'",
    description: "Replace enhanced-hook-mocks imports with unified index"
  },
  {
    pattern: /from ['"]@\/test\/input-utilities['"]/g,
    replacement: "from '@/test'",
    description: "Replace input-utilities imports with unified index"
  },
  {
    pattern: /from ['"]@\/test\/standardized-mocks['"]/g,
    replacement: "from '@/test'",
    description: "Replace standardized-mocks imports with unified index"
  }
];

// Find all test files
const testFiles = glob.sync('apps/frontend/src/**/*.{test,spec}.{ts,tsx}', {
  ignore: ['**/node_modules/**', '**/dist/**']
});

console.log(`Found ${testFiles.length} test files to analyze...\n`);

let totalReplacements = 0;
let filesModified = 0;

testFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let fileReplacements = 0;
  
  IMPORT_PATTERNS.forEach(({ pattern, replacement, description }) => {
    const matches = content.match(pattern);
    if (matches) {
      newContent = newContent.replace(pattern, replacement);
      fileReplacements += matches.length;
      console.log(`  ✓ ${description}: ${matches.length} replacement(s)`);
    }
  });
  
  if (fileReplacements > 0) {
    // Write the updated content back to the file
    fs.writeFileSync(filePath, newContent);
    console.log(`📝 Updated ${filePath} (${fileReplacements} replacements)\n`);
    filesModified++;
    totalReplacements += fileReplacements;
  }
});

console.log(`\n✅ Import consolidation complete!`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplacements}`);

// Check for any remaining old imports
console.log('\n🔍 Checking for remaining old imports...');

const remainingPatterns = [
  /import.*from ['"]@\/test\/test-utils['"]/g,
  /import.*from ['"]@\/test\/enhanced-test-utils['"]/g,
  /import.*from ['"]@\/test\/enhanced-setup['"]/g,
  /import.*from ['"]@\/test\/enhanced-test-setup['"]/g,
  /import.*from ['"]@\/test\/optimized-setup['"]/g,
  /import.*from ['"]@\/test\/enhanced-hook-mocks['"]/g,
  /import.*from ['"]@\/test\/input-utilities['"]/g,
  /import.*from ['"]@\/test\/standardized-mocks['"]/g,
];

let remainingIssues = 0;

testFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  
  remainingPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`⚠️  ${filePath}: Still has old import pattern`);
      matches.forEach(match => console.log(`    ${match}`));
      remainingIssues++;
    }
  });
});

if (remainingIssues === 0) {
  console.log('✅ No remaining old import patterns found!');
} else {
  console.log(`⚠️  Found ${remainingIssues} files with remaining old imports`);
}

console.log('\n📋 Next steps:');
console.log('1. Run tests to ensure all imports work correctly');
console.log('2. Check for any compilation errors');
console.log('3. Review the MIGRATION-GUIDE.md for any manual updates needed');
console.log('4. Consider removing deprecated utility files after migration is complete');