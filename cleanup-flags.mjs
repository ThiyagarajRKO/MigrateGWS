#!/usr/bin/env node

/**
 * Script to remove realDataMode and dryRun flags from all migration APIs
 * This simplifies the testing and makes the behavior more predictable
 */

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { glob } from 'glob'

const MIGRATION_API_PATTERN = 'src/app/api/v1/migration/**/route.ts'

async function removeFlags() {
  console.log('🔍 Finding migration API files...')
  
  const files = await glob(MIGRATION_API_PATTERN, { ignore: '**/node_modules/**' })
  console.log(`Found ${files.length} migration API files`)
  
  for (const file of files) {
    console.log(`\n📝 Processing ${file}...`)
    
    try {
      let content = await readFile(file, 'utf8')
      let modified = false
      
      // Remove from interface definitions
      if (content.includes('realDataMode?: boolean')) {
        console.log('  ✓ Removing realDataMode from interface')
        content = content.replace(/\s*realDataMode\?\s*:\s*boolean\s*\n/g, '\n')
        modified = true
      }
      
      if (content.includes('dryRun?: boolean')) {
        console.log('  ✓ Removing dryRun from interface')
        content = content.replace(/\s*dryRun\?\s*:\s*boolean\s*\n/g, '\n')
        modified = true
      }
      
      // Remove from destructuring assignments
      const destructurePattern = /(\s*)(realDataMode\s*=\s*[^,\n]+,?\s*\n|\s*dryRun\s*=\s*[^,\n]+,?\s*\n)/g
      if (destructurePattern.test(content)) {
        console.log('  ✓ Removing from destructuring assignments')
        content = content.replace(destructurePattern, '')
        modified = true
      }
      
      // Remove console.log statements
      if (content.includes('Real Data Mode:') || content.includes('Dry Run:')) {
        console.log('  ✓ Removing console.log statements')
        content = content.replace(/\s*console\.log\(`.*Real Data Mode.*`\)\s*\n/g, '\n')
        content = content.replace(/\s*console\.log\(`.*Dry Run.*`\)\s*\n/g, '\n')
        modified = true
      }
      
      // Remove function parameters
      const funcParamPattern = /(\s*realDataMode\s*:\s*boolean[^,\n]*,?\s*\n|\s*dryRun\s*:\s*boolean[^,\n]*,?\s*\n)/g
      if (funcParamPattern.test(content)) {
        console.log('  ✓ Removing function parameters')
        content = content.replace(funcParamPattern, '')
        modified = true
      }
      
      // Remove function argument passing
      if (content.includes('realDataMode,') || content.includes('dryRun,') || 
          content.includes('realDataMode:') || content.includes('dryRun:')) {
        console.log('  ✓ Removing function arguments')
        content = content.replace(/\s*realDataMode,?\s*\n/g, '\n')
        content = content.replace(/\s*dryRun,?\s*\n/g, '\n')
        content = content.replace(/\s*realDataMode\s*:\s*[^,\n]+,?\s*\n/g, '\n')
        content = content.replace(/\s*dryRun\s*:\s*[^,\n]+,?\s*\n/g, '\n')
        modified = true
      }
      
      // Remove conditional logic using these flags
      const conditionalPattern = /(if\s*\(\s*dryRun\s*\)\s*\{[^}]*\}\s*else\s*)?(if\s*\(\s*realDataMode\s*\)\s*\{[^}]*\})/g
      if (conditionalPattern.test(content)) {
        console.log('  ✓ Simplifying conditional logic')
        // This is complex - for now just remove the conditions and keep the realDataMode block content
        content = content.replace(/if\s*\(\s*dryRun\s*\)\s*\{[^}]*\}\s*else\s*if\s*\(\s*realDataMode\s*\)\s*\{/g, '{')
        content = content.replace(/if\s*\(\s*realDataMode\s*\)\s*\{/g, '{')
        content = content.replace(/if\s*\(\s*dryRun\s*\)\s*\{[^}]*\}\s*else\s*\{/g, '{')
        modified = true
      }
      
      // Remove complex conditions like (!realDataMode || dryRun)
      const complexCondPattern = /!\s*realDataMode\s*\|\|\s*dryRun/g
      if (complexCondPattern.test(content)) {
        console.log('  ✓ Simplifying complex conditions')
        content = content.replace(complexCondPattern, 'false')
        modified = true
      }
      
      // Remove options.realDataMode and options.dryRun references
      if (content.includes('options.realDataMode') || content.includes('options.dryRun')) {
        console.log('  ✓ Removing options references')
        content = content.replace(/options\.realDataMode/g, 'true')
        content = content.replace(/options\.dryRun/g, 'false')
        content = content.replace(/\(!options\.realDataMode\)/g, 'false')
        modified = true
      }
      
      // Clean up any trailing commas or empty lines
      content = content.replace(/,\s*\n\s*\}/g, '\n}')
      content = content.replace(/\n\s*\n\s*\n/g, '\n\n')
      
      if (modified) {
        await writeFile(file, content, 'utf8')
        console.log('  ✅ File updated successfully')
      } else {
        console.log('  ⏭️  No changes needed')
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error.message)
    }
  }
  
  console.log('\n🎉 Cleanup completed!')
}

// Run the cleanup
removeFlags().catch(console.error)
