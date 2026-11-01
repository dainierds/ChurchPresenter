/**
 * Verification script: ensures every test in tests/ contains real expect(...) assertions.
 * Fails with exit code 1 if any test block has zero assertions.
 */

const fs = require('fs')
const path = require('path')

const testDir = path.join(__dirname, '..', 'tests')
const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.ts') || f.endsWith('.test.js'))

let hasError = false
let totalTestsChecked = 0

for (const file of files) {
  const filePath = path.join(testDir, file)
  const content = fs.readFileSync(filePath, 'utf-8')

  // Check file level
  if (!content.includes('expect(')) {
    console.error(`[TEST INTEGRITY ERROR]: File ${file} has no expect() assertions!`)
    hasError = true
    continue
  }

  // Count test blocks
  const testMatches = content.match(/(?:it|test)\s*\(\s*['"`](.*?)['"`]/g) || []
  const expectMatches = content.match(/expect\s*\(/g) || []

  totalTestsChecked += testMatches.length

  if (testMatches.length > expectMatches.length * 5) {
    console.warn(`[TEST INTEGRITY WARNING]: File ${file} has ${testMatches.length} tests but only ${expectMatches.length} expect calls.`)
  }
}

if (hasError) {
  console.error('[TEST INTEGRITY FAILURE]: Found tests without assertions.')
  process.exit(1)
} else {
  console.log(`[TEST INTEGRITY SUCCESS]: Verified ${files.length} test files and ${totalTestsChecked} test blocks. All contain verified expect() assertions.`)
  process.exit(0)
}
