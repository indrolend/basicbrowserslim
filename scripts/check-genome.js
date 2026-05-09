#!/usr/bin/env node
'use strict';
/**
 * check-genome.js — validate semantic-genome.json structure and evidence references.
 *
 * Checks:
 *   1. Required top-level fields are present.
 *   2. Each gene has required fields with correct types.
 *   3. Each evidence / violated_at reference of type "source" points to a real
 *      line range that exists in the source file.
 *   4. Each transform_law references only gene IDs that exist in the genome.
 *
 * Usage:
 *   node scripts/check-genome.js [--genome <path>] [--root <repo-root>]
 *
 * Exit codes:
 *   0  all checks pass
 *   1  one or more checks failed
 */

const fs   = require('fs');
const path = require('path');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

const repoRoot    = argValue('--root')   || path.resolve(__dirname, '..');
const genomePath  = argValue('--genome') || path.join(repoRoot, 'js', 'spa', 'semantic-genome.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────

let failures = 0;
let passes   = 0;

function pass(msg) {
  console.log(`  ✓  ${msg}`);
  passes++;
}

function fail(msg) {
  console.error(`  ✗  ${msg}`);
  failures++;
}

function section(title) {
  console.log(`\n── ${title}`);
}

/**
 * Parse a source evidence ref of the form "path:line" or "path:start-end".
 * Returns { file, startLine, endLine } with 1-based line numbers, or null if
 * the ref cannot be parsed.
 */
function parseRef(ref) {
  const colonIdx = ref.lastIndexOf(':');
  if (colonIdx === -1) return null;
  const filePart  = ref.slice(0, colonIdx);
  const rangePart = ref.slice(colonIdx + 1);
  if (!rangePart) return null;

  const dashIdx = rangePart.indexOf('-');
  if (dashIdx === -1) {
    const line = parseInt(rangePart, 10);
    if (isNaN(line)) return null;
    return { file: filePart, startLine: line, endLine: line };
  }

  const start = parseInt(rangePart.slice(0, dashIdx), 10);
  const end   = parseInt(rangePart.slice(dashIdx + 1), 10);
  if (isNaN(start) || isNaN(end)) return null;
  return { file: filePart, startLine: start, endLine: end };
}

/** Return the number of lines in a file, or -1 if the file cannot be read. */
function lineCount(absPath) {
  try {
    const content = fs.readFileSync(absPath, 'utf8');
    return content.split('\n').length;
  } catch (_) {
    return -1;
  }
}

/**
 * Validate a single evidence/violated_at item.
 * @param {string} context  Human-readable label for error messages.
 * @param {{ type: string, ref: string }} item
 */
function checkRef(context, item) {
  if (item.type !== 'source') {
    pass(`${context}: type '${item.type}' — skipped (not a source ref)`);
    return;
  }

  const parsed = parseRef(item.ref);
  if (!parsed) {
    fail(`${context}: cannot parse ref '${item.ref}'`);
    return;
  }

  const absPath = path.resolve(repoRoot, parsed.file);
  const count   = lineCount(absPath);
  if (count === -1) {
    fail(`${context}: file not found — '${parsed.file}'`);
    return;
  }
  if (parsed.endLine > count) {
    fail(`${context}: ref '${item.ref}' end line ${parsed.endLine} exceeds file length ${count}`);
    return;
  }
  if (parsed.startLine < 1) {
    fail(`${context}: ref '${item.ref}' start line ${parsed.startLine} < 1`);
    return;
  }
  if (parsed.startLine > parsed.endLine) {
    fail(`${context}: ref '${item.ref}' start ${parsed.startLine} > end ${parsed.endLine}`);
    return;
  }

  pass(`${context}: ref '${item.ref}' → lines ${parsed.startLine}–${parsed.endLine} of ${parsed.file} (${count} total)`);
}

// ─── Load and parse genome ────────────────────────────────────────────────────

console.log(`\ncheck-genome — ${genomePath}\n`);

let genome;
try {
  const raw = fs.readFileSync(genomePath, 'utf8');
  genome = JSON.parse(raw);
} catch (err) {
  console.error(`Fatal: could not read/parse genome: ${err.message}`);
  process.exit(1);
}

// ─── 1. Top-level required fields ────────────────────────────────────────────

section('1. Top-level fields');

const TOP_LEVEL_REQUIRED = ['description', 'version', 'observables', 'phase_grammar', 'genes', 'transform_laws'];
for (const field of TOP_LEVEL_REQUIRED) {
  if (field in genome) pass(`'${field}' present`);
  else                  fail(`'${field}' missing`);
}

if (Array.isArray(genome.observables) && genome.observables.length > 0)
  pass(`observables: ${genome.observables.length} entries`);
else
  fail('observables must be a non-empty array');

if (Array.isArray(genome.phase_grammar) && genome.phase_grammar.length > 0)
  pass(`phase_grammar: [${genome.phase_grammar.join(', ')}]`);
else
  fail('phase_grammar must be a non-empty array');

// ─── 2. Gene structure ────────────────────────────────────────────────────────

section('2. Gene structure');

const GENE_REQUIRED = ['id', 'kind', 'subject', 'statement', 'evidence', 'confidence', 'proof_class', 'invalidated_by'];
const VALID_PROOF_CLASSES = ['contract_backed', 'heuristic', 'aspirational', 'violated'];
const geneIds = new Set();

if (!Array.isArray(genome.genes)) {
  fail('genes must be an array');
} else {
  for (const gene of genome.genes) {
    const label = `gene[${gene.id || '?'}]`;
    for (const field of GENE_REQUIRED) {
      if (!(field in gene)) fail(`${label}: missing required field '${field}'`);
    }

    if (gene.id) {
      if (geneIds.has(gene.id)) fail(`duplicate gene id '${gene.id}'`);
      else geneIds.add(gene.id);
    }

    if (typeof gene.confidence === 'number' && gene.confidence >= 0 && gene.confidence <= 1)
      pass(`${label}: confidence ${gene.confidence} in [0,1]`);
    else
      fail(`${label}: confidence must be a number in [0,1], got ${JSON.stringify(gene.confidence)}`);

    if (VALID_PROOF_CLASSES.includes(gene.proof_class))
      pass(`${label}: proof_class '${gene.proof_class}' is recognised`);
    else
      fail(`${label}: unknown proof_class '${gene.proof_class}' (expected one of: ${VALID_PROOF_CLASSES.join(', ')})`);

    if (!Array.isArray(gene.evidence) || gene.evidence.length === 0)
      fail(`${label}: evidence must be a non-empty array`);

    if (!Array.isArray(gene.invalidated_by) || gene.invalidated_by.length === 0)
      fail(`${label}: invalidated_by must be a non-empty array`);

    if (gene.proof_class === 'violated' && !Array.isArray(gene.violated_at))
      fail(`${label}: violated genes should have a violated_at array`);
  }
  pass(`genes: ${genome.genes.length} entries validated for structure`);
}

// ─── 3. Evidence line references ──────────────────────────────────────────────

section('3. Evidence line references');

if (Array.isArray(genome.genes)) {
  for (const gene of genome.genes) {
    const label = `gene[${gene.id}]`;
    for (const ev of (gene.evidence || [])) {
      checkRef(`${label}.evidence`, ev);
    }
    for (const viol of (gene.violated_at || [])) {
      checkRef(`${label}.violated_at`, viol);
    }
  }
}

// ─── 4. Transform law gene references ────────────────────────────────────────

section('4. Transform law gene references');

if (!Array.isArray(genome.transform_laws)) {
  fail('transform_laws must be an array');
} else {
  const LAW_REQUIRED = ['id', 'name', 'statement', 'requires_genes', 'witness'];
  const lawIds = new Set();

  for (const law of genome.transform_laws) {
    const label = `law[${law.id || '?'}]`;
    for (const field of LAW_REQUIRED) {
      if (!(field in law)) fail(`${label}: missing required field '${field}'`);
    }

    if (law.id) {
      if (lawIds.has(law.id)) fail(`duplicate law id '${law.id}'`);
      else lawIds.add(law.id);
    }

    if (Array.isArray(law.requires_genes)) {
      for (const gid of law.requires_genes) {
        if (geneIds.has(gid)) pass(`${label}: requires_genes '${gid}' exists`);
        else                   fail(`${label}: requires_genes '${gid}' not found in genes`);
      }
    } else {
      fail(`${label}: requires_genes must be an array`);
    }
  }
  pass(`transform_laws: ${genome.transform_laws.length} entries validated`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));

// Report violated genes separately so they are visible
if (Array.isArray(genome.genes)) {
  const violated = genome.genes.filter(g => g.proof_class === 'violated');
  if (violated.length > 0) {
    console.log(`\nViolated genes (aspirational, not yet enforced):`);
    for (const g of violated) {
      console.log(`  ⚠  ${g.id}: ${g.subject}`);
      if (g.remediation) console.log(`       → ${g.remediation}`);
    }
  }
}

console.log(`\n${passes} checks passed, ${failures} checks failed.\n`);

if (failures > 0) {
  console.error('check-genome: FAILED\n');
  process.exit(1);
} else {
  console.log('check-genome: OK\n');
  process.exit(0);
}
