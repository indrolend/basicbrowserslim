#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);

function hasFlag(flag) {
  return args.includes(flag);
}

function argValue(flag, fallback = null) {
  const idx = args.indexOf(flag);
  if (idx === -1) return fallback;
  return args[idx + 1] || fallback;
}

const repoRoot = path.resolve(argValue('--root', path.resolve(__dirname, '..')));
const genomePath = path.resolve(argValue('--genome', path.join(repoRoot, 'js', 'spa', 'semantic-genome.json')));
const changedMode = hasFlag('--changed');
const INVALIDATION_SCAN_SOURCE_RE = /^js\/spa\/.+\.(js|mjs|cjs)$/i;

let passCount = 0;
let failCount = 0;
let warnCount = 0;
let changedModeWarning = null;

function ok(msg) {
  console.log(`  ✓ ${msg}`);
  passCount++;
}

function warn(msg) {
  console.log(`  ⚠ ${msg}`);
  warnCount++;
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failCount++;
}

function section(title) {
  console.log(`\n── ${title}`);
}

function safeRelative(p) {
  return path.relative(repoRoot, p).split(path.sep).join('/');
}

function normalizeRepoPath(relPath) {
  const abs = path.resolve(repoRoot, relPath);
  const rel = path.relative(repoRoot, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return abs;
}

function parseSourceRef(ref) {
  if (typeof ref !== 'string' || ref.length === 0) return null;
  const colonIdx = ref.lastIndexOf(':');
  if (colonIdx === -1) {
    return { file: ref, startLine: null, endLine: null };
  }

  const file = ref.slice(0, colonIdx);
  const maybeRange = ref.slice(colonIdx + 1);
  if (!maybeRange) return null;

  if (/^\d+$/.test(maybeRange)) {
    const line = Number(maybeRange);
    return { file, startLine: line, endLine: line };
  }

  const match = maybeRange.match(/^(\d+)-(\d+)$/);
  if (match) {
    return { file, startLine: Number(match[1]), endLine: Number(match[2]) };
  }

  return null;
}

function countLines(text) {
  return text.split('\n').length;
}

function readJsonFile(absPath) {
  try {
    const raw = fs.readFileSync(absPath, 'utf8');
    return { value: JSON.parse(raw), error: null };
  } catch (error) {
    return { value: null, error };
  }
}

function parseSubjectTokens(subject) {
  if (typeof subject !== 'string') return [];
  const tokens = new Set();
  const trimmed = subject.trim();
  if (!trimmed) return [];
  tokens.add(trimmed);
  for (const part of trimmed.split(/[.\s/()]+/).filter(Boolean)) {
    if (part.length >= 3) tokens.add(part);
  }
  return [...tokens];
}

function execGit(command) {
  try {
    return execSync(command, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
  } catch (_) {
    return '';
  }
}

function existingRef(ref) {
  const exists = execGit(`git rev-parse --verify --quiet ${ref}`);
  return !!exists;
}

function changedFileList() {
  const candidates = ['origin/main', 'main', 'origin/master', 'master'];
  let baseRef = null;
  for (const ref of candidates) {
    if (existingRef(ref)) {
      baseRef = ref;
      break;
    }
  }

  if (!baseRef) {
    if (existingRef('HEAD~1')) {
      changedModeWarning = 'No main/master ref found; using HEAD~1..HEAD for --changed.';
      const out = execGit('git diff --name-only HEAD~1..HEAD');
      return out ? out.split('\n').filter(Boolean) : [];
    }
    changedModeWarning = 'No base ref available for --changed.';
    return [];
  }

  const mergeBase = execGit(`git merge-base ${baseRef} HEAD`);
  const range = mergeBase ? `${mergeBase}..HEAD` : `${baseRef}..HEAD`;
  const out = execGit(`git diff --name-only ${range}`);
  return out ? out.split('\n').filter(Boolean) : [];
}

console.log(`\ncheck-semantic-genome — ${genomePath}\n`);

section('1. JSON parse + top-level shape');

if (!fs.existsSync(genomePath)) {
  fail(`Genome file not found: ${genomePath}`);
  console.log('\ncheck-semantic-genome: FAILED\n');
  process.exit(1);
}
ok('Genome file exists');

const parsed = readJsonFile(genomePath);
if (parsed.error) {
  fail(`Invalid JSON: ${parsed.error.message}`);
  console.log('\ncheck-semantic-genome: FAILED\n');
  process.exit(1);
}
ok('Valid JSON');

const genome = parsed.value;
const requiredTopLevel = ['version', 'observables', 'phase_grammar', 'genes', 'transform_laws'];
for (const key of requiredTopLevel) {
  if (Object.prototype.hasOwnProperty.call(genome, key)) ok(`top-level key present: ${key}`);
  else fail(`missing top-level key: ${key}`);
}

if (Array.isArray(genome.observables)) ok(`observables is array (${genome.observables.length})`);
else fail('observables must be an array');

if (Array.isArray(genome.phase_grammar)) ok(`phase_grammar is array (${genome.phase_grammar.length})`);
else fail('phase_grammar must be an array');

if (Array.isArray(genome.genes)) ok(`genes is array (${genome.genes.length})`);
else fail('genes must be an array');

if (Array.isArray(genome.transform_laws)) ok(`transform_laws is array (${genome.transform_laws.length})`);
else fail('transform_laws must be an array');

if (typeof genome.last_verified_commit === 'string' && genome.last_verified_commit.trim()) {
  const commitRef = genome.last_verified_commit.trim();
  const commitExists = execGit(`git rev-parse --verify --quiet ${commitRef}`);
  if (commitExists) ok(`last_verified_commit resolves locally: ${commitRef}`);
  else warn(`last_verified_commit does not resolve in this clone: ${commitRef} (possible stale marker)`);
} else {
  warn('last_verified_commit missing or empty; consider updating it when genome verification is refreshed.');
}

section('2. Gene shape + evidence checks');

const geneRequired = [
  'id',
  'kind',
  'subject',
  'statement',
  'observable_effect',
  'evidence',
  'confidence',
  'proof_class',
  'invalidated_by'
];
const genes = Array.isArray(genome.genes) ? genome.genes : [];
const geneIds = new Set();
const geneRefsByFile = new Map();
const geneWarnById = new Map();

function noteGeneWarn(geneId, message) {
  if (!geneWarnById.has(geneId)) geneWarnById.set(geneId, []);
  geneWarnById.get(geneId).push(message);
  warn(`gene[${geneId}] ${message}`);
}

for (const gene of genes) {
  const id = gene && gene.id ? String(gene.id) : '?';
  for (const key of geneRequired) {
    if (Object.prototype.hasOwnProperty.call(gene || {}, key)) ok(`gene[${id}] has ${key}`);
    else fail(`gene[${id}] missing ${key}`);
  }

  if (geneIds.has(id)) fail(`duplicate gene id: ${id}`);
  else geneIds.add(id);

  if (typeof gene.confidence === 'number' && gene.confidence >= 0 && gene.confidence <= 1) {
    ok(`gene[${id}] confidence in range`);
  } else {
    fail(`gene[${id}] confidence must be number in [0,1]`);
  }

  if (!Array.isArray(gene.evidence) || gene.evidence.length === 0) {
    fail(`gene[${id}] evidence must be non-empty array`);
    continue;
  }
  if (gene.evidence.length < 2) noteGeneWarn(id, 'has only one evidence item (weak evidence)');

  for (const ev of gene.evidence) {
    if (!ev || typeof ev !== 'object') {
      fail(`gene[${id}] evidence item must be object`);
      continue;
    }
    if (typeof ev.ref !== 'string') {
      fail(`gene[${id}] evidence ref must be string`);
      continue;
    }

    if (ev.type && ev.type !== 'source') {
      ok(`gene[${id}] evidence type '${ev.type}' skipped (non-source)`);
      continue;
    }

    const src = parseSourceRef(ev.ref);
    if (!src) {
      fail(`gene[${id}] invalid source ref format: ${ev.ref}`);
      continue;
    }

    const absSource = normalizeRepoPath(src.file);
    if (!absSource) {
      fail(`gene[${id}] evidence path escapes repo: ${src.file}`);
      continue;
    }

    if (!fs.existsSync(absSource)) {
      fail(`gene[${id}] evidence file missing: ${src.file}`);
      continue;
    }
    ok(`gene[${id}] evidence file exists: ${src.file}`);

    const sourceText = fs.readFileSync(absSource, 'utf8');
    const lineTotal = countLines(sourceText);
    if (src.startLine != null) {
      if (src.startLine < 1 || src.endLine < src.startLine) {
        fail(`gene[${id}] invalid line range in ref: ${ev.ref}`);
        continue;
      }
      if (src.endLine > lineTotal) {
        fail(`gene[${id}] line range exceeds file length (${lineTotal}): ${ev.ref}`);
        continue;
      }
      ok(`gene[${id}] line range plausible: ${src.startLine}-${src.endLine}/${lineTotal}`);
    } else {
      warn(`gene[${id}] evidence has no line range: ${ev.ref}`);
    }

    const subjectTokens = parseSubjectTokens(gene.subject);
    if (subjectTokens.length) {
      const hit = subjectTokens.some((token) => sourceText.includes(token));
      if (hit) ok(`gene[${id}] subject text appears in ${src.file}`);
      else noteGeneWarn(id, `subject text not found in ${src.file} (possible stale evidence)`);
    }

    const repoRel = safeRelative(absSource);
    if (!geneRefsByFile.has(repoRel)) geneRefsByFile.set(repoRel, new Set());
    geneRefsByFile.get(repoRel).add(id);
  }

  const invalidatedBy = Array.isArray(gene.invalidated_by) ? gene.invalidated_by : [];
  if (invalidatedBy.length === 0) {
    noteGeneWarn(id, 'has empty invalidated_by');
  } else {
    ok(`gene[${id}] invalidated_by has ${invalidatedBy.length} item(s)`);
  }
}

section('3. Transform law checks');

const transformLaws = Array.isArray(genome.transform_laws) ? genome.transform_laws : [];
const lawRequired = ['id', 'name', 'requires_genes'];
const lawIds = new Set();

for (const law of transformLaws) {
  const id = law && law.id ? String(law.id) : '?';
  for (const key of lawRequired) {
    if (Object.prototype.hasOwnProperty.call(law || {}, key)) ok(`law[${id}] has ${key}`);
    else fail(`law[${id}] missing ${key}`);
  }

  if (lawIds.has(id)) fail(`duplicate law id: ${id}`);
  else lawIds.add(id);

  if (!Array.isArray(law.requires_genes)) {
    fail(`law[${id}] requires_genes must be array`);
    continue;
  }

  for (const gid of law.requires_genes) {
    if (geneIds.has(gid)) ok(`law[${id}] references existing gene: ${gid}`);
    else fail(`law[${id}] references unknown gene: ${gid}`);
  }
}

if (changedMode) {
  section('4. Changed-file impact');
  const changedFiles = changedFileList();
  if (changedModeWarning) warn(changedModeWarning);
  if (changedFiles.length === 0) {
    warn('No changed files detected.');
  } else {
    ok(`Detected ${changedFiles.length} changed file(s)`);
    for (const f of changedFiles) console.log(`  • ${f}`);
  }

  const affectedGenes = new Set();
  const staleGenes = new Set();
  for (const changed of changedFiles) {
    const rel = changed.split(path.sep).join('/');
    const genesForFile = geneRefsByFile.get(rel);
    if (!genesForFile) continue;
    for (const gid of genesForFile) {
      affectedGenes.add(gid);
      const warns = geneWarnById.get(gid) || [];
      if (warns.some((w) => w.includes('possible stale evidence'))) staleGenes.add(gid);
    }
  }

  if (affectedGenes.size === 0) {
    warn('No genes mapped to changed files.');
  } else {
    ok(`Affected genes: ${affectedGenes.size}`);
    for (const gid of [...affectedGenes].sort()) console.log(`  • ${gid}`);
  }

  const affectedLaws = [];
  for (const law of transformLaws) {
    const deps = Array.isArray(law.requires_genes) ? law.requires_genes : [];
    if (deps.some((gid) => affectedGenes.has(gid))) affectedLaws.push(law);
  }

  if (affectedLaws.length === 0) {
    warn('No transform laws depend on affected genes.');
  } else {
    ok(`Affected transform laws: ${affectedLaws.length}`);
    for (const law of affectedLaws) {
      const depText = law.requires_genes.filter((gid) => affectedGenes.has(gid)).join(', ');
      console.log(`  • ${law.id} (${law.name}) via [${depText}]`);
    }
  }

  if (staleGenes.size > 0) {
    warn(`Potentially stale genes from changed files: ${[...staleGenes].sort().join(', ')}`);
  }

  // Common generic words that produce false positives when matching
  // invalidation hints against changed source content.
  const stopWords = new Set([
    'any', 'new', 'add', 'added', 'addition', 'change', 'changes', 'removal', 'remove', 'file',
    'path', 'module', 'modules', 'code', 'outside', 'without', 'with', 'that', 'this', 'from',
    'into', 'where', 'when', 'then', 'rather', 'than', 'does', 'not', 'call', 'calls',
    'start', 'stop', 'set'
  ]);
  const changedSourceTexts = [];
  for (const rel of changedFiles) {
    const abs = normalizeRepoPath(rel);
    if (!abs || !fs.existsSync(abs)) continue;
    if (!INVALIDATION_SCAN_SOURCE_RE.test(rel)) continue;
    changedSourceTexts.push(fs.readFileSync(abs, 'utf8'));
  }
  const changedText = changedSourceTexts.join('\n');
  const obviousInvalidated = [];
  if (changedText) {
    for (const gene of genes) {
      const clues = [];
      for (const rule of Array.isArray(gene.invalidated_by) ? gene.invalidated_by : []) {
        if (typeof rule !== 'string') continue;
        const tokens = rule
          .toLowerCase()
          .split(/[^a-z0-9_.]+/)
          .filter((t) => t && t.length >= 4 && !stopWords.has(t));
        for (const token of tokens) clues.push(token);
      }
      const uniqueClues = [...new Set(clues)];
      if (uniqueClues.length === 0) continue;
      const hitCount = uniqueClues.filter((token) => changedText.toLowerCase().includes(token)).length;
      if (hitCount >= 2) obviousInvalidated.push(gene.id);
    }
  }
  if (obviousInvalidated.length > 0) {
    warn(`Genes with possible invalidation clues in changed source content: ${obviousInvalidated.join(', ')}`);
  }
}

console.log('\n' + '─'.repeat(60));
console.log(`\nSummary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed.`);
console.log('What is validated mechanically: JSON parse, schema-like shape, evidence file/range/path checks, subject-text plausibility, and law→gene linkage.');
console.log('What remains descriptive only: behavioral truth of each invariant and runtime equivalence claims in transform laws.');

if (failCount > 0) {
  console.error('\ncheck-semantic-genome: FAILED\n');
  process.exit(1);
}
console.log('\ncheck-semantic-genome: OK\n');
