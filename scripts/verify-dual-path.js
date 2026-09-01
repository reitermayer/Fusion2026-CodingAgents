#!/usr/bin/env node

/**
 * Verification Hook / Linter for Coding Agents Tutorial
 * 
 * Enforces two mandatory rules across all Chapters/*.md files:
 * 1. Dual-Path Rule: Every shell code block containing executable `uip ` commands 
 *    must be preceded by a "Prompt Your AI Coding Agent" (💬 Prompt) section.
 * 2. Formatting Rule: No em dashes (—) allowed (use standard hyphens `-` instead).
 */

const fs = require('fs');
const path = require('path');

const chaptersDir = path.join(__dirname, '..', 'Chapters');
const files = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.md')).sort();

let totalErrors = 0;
console.log('🔍 Running Dual-Path & Formatting Verification for Tutorial Chapters...\n');

files.forEach(file => {
  const filePath = path.join(chaptersDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let inCodeBlock = false;
  let codeBlockLang = '';
  let currentCodeBlock = [];
  let blockStartLine = 0;
  let codeBlocks = [];

  // Check Rule 1: No em dashes (—)
  lines.forEach((line, idx) => {
    if (line.includes('—')) {
      console.error(`❌ [${file}:${idx + 1}] Found em dash (—). Use standard hyphen (-) instead.`);
      totalErrors++;
    }
  });

  // Extract code blocks (excluding mermaid, json, yaml, text)
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        codeBlocks.push({
          lang: codeBlockLang,
          startLine: blockStartLine,
          endLine: idx + 1,
          content: currentCodeBlock.join('\n')
        });
        currentCodeBlock = [];
        inCodeBlock = false;
        codeBlockLang = '';
      } else {
        inCodeBlock = true;
        codeBlockLang = trimmed.replace(/^```/, '').trim().toLowerCase();
        blockStartLine = idx + 1;
      }
    } else if (inCodeBlock) {
      currentCodeBlock.push(line);
    }
  });

  // Check Rule 2: Each actionable shell block with `uip ` must have a preceding Prompt section
  codeBlocks.forEach(block => {
    // Skip non-executable / diagram languages
    if (['mermaid', 'json', 'yaml', 'csharp', 'cs', 'xml', 'text', 'carousel'].includes(block.lang)) {
      return;
    }

    // Check for actionable uip commands
    if (/\buip\s+(solution|maestro|agent|rpa|tm|skills|traces|orchestrator)/.test(block.content)) {
      // Look back up to 30 lines before blockStartLine for a Prompt marker
      const searchWindowStart = Math.max(0, block.startLine - 30);
      const precedingText = lines.slice(searchWindowStart, block.startLine - 1).join('\n');
      
      const hasPromptMarker = /Prompt\s+Your\s+(?:AI\s+)?Coding\s+Agent/i.test(precedingText) ||
                              /💬\s*Prompt/i.test(precedingText) ||
                              /Copy-Paste\s+Prompt/i.test(precedingText) ||
                              /Student\s+Prompt/i.test(precedingText) ||
                              /Quick-Reset/i.test(precedingText) ||
                              /Fast-Forward/i.test(precedingText);

      if (!hasPromptMarker) {
        console.error(`❌ [${file}:${block.startLine}] Missing human-readable prompt before \`uip\` command block.`);
        console.error(`   Found command: "${block.content.trim().split('\n')[0]}"`);
        console.error(`   Expected preceding "### 💬 Prompt Your AI Coding Agent" section.\n`);
        totalErrors++;
      }
    }
  });

  if (totalErrors === 0) {
    console.log(`✅ ${file}: Passed all dual-path & formatting checks.`);
  }
});

// Check Rule 3: AGENTS.md and CLAUDE.md must stay byte-identical.
// Claude Code reads CLAUDE.md; Antigravity, Gemini, Cursor, Copilot and
// UiPath Autopilot read AGENTS.md. If they drift, whichever agent reads the
// stale copy builds the tutorial against outdated rules.
const rootDir = path.join(__dirname, '..');
const agentsPath = path.join(rootDir, 'AGENTS.md');
const claudePath = path.join(rootDir, 'CLAUDE.md');

if (!fs.existsSync(agentsPath) || !fs.existsSync(claudePath)) {
  console.error('\n❌ [AGENTS.md / CLAUDE.md] One of the two agent briefing files is missing.');
  console.error('   Both must exist so every coding agent reads the same rules.\n');
  totalErrors++;
} else {
  const agentsContent = fs.readFileSync(agentsPath, 'utf8');
  const claudeContent = fs.readFileSync(claudePath, 'utf8');

  if (agentsContent !== claudeContent) {
    const a = agentsContent.split('\n');
    const c = claudeContent.split('\n');
    const firstDiff = (() => {
      for (let i = 0; i < Math.max(a.length, c.length); i++) {
        if (a[i] !== c[i]) return i + 1;
      }
      return 0;
    })();

    console.error('\n❌ [AGENTS.md / CLAUDE.md] The two agent briefing files are out of sync.');
    console.error(`   First difference at line ${firstDiff}:`);
    console.error(`     AGENTS.md: ${a[firstDiff - 1] === undefined ? '<missing line>' : JSON.stringify(a[firstDiff - 1])}`);
    console.error(`     CLAUDE.md: ${c[firstDiff - 1] === undefined ? '<missing line>' : JSON.stringify(c[firstDiff - 1])}`);
    console.error('   Fix by copying the up-to-date file over the other, e.g. `cp AGENTS.md CLAUDE.md`.\n');
    totalErrors++;
  } else {
    console.log('✅ AGENTS.md / CLAUDE.md: byte-identical (all coding agents read the same rules).');
  }
}

console.log('\n--------------------------------------------------');
if (totalErrors > 0) {
  console.error(`💥 Verification FAILED: Found ${totalErrors} issue(s). Please fix before committing.\n`);
  process.exit(1);
} else {
  console.log('🎉 Verification PASSED: All chapters conform to the Dual-Path standard!\n');
  process.exit(0);
}
