#!/usr/bin/env node
'use strict';
/**
 * export-genome-prompt.js — export semantic-genome.json as a compact
 * machine-consumable Markdown contract for LLM-based static recompilation.
 *
 * Usage:
 *   node scripts/export-genome-prompt.js [--genome <path>] [--out <file>] [--root <repo-root>]
 *
 * Outputs to stdout by default; use --out to write to a file.
 *
 * The output is a structured Markdown document that an LLM agent can prepend
 * to any recompilation prompt in order to constrain its transformations to
 * behavior-preserving rewrites.
 */

const fs   = require('fs');
const path = require('path');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

const repoRoot   = argValue('--root')   || path.resolve(__dirname, '..');
const genomePath = argValue('--genome') || path.join(repoRoot, 'js', 'spa', 'semantic-genome.json');
const outPath    = argValue('--out')    || null;

// ─── Load genome ──────────────────────────────────────────────────────────────

let genome;
try {
  const raw = fs.readFileSync(genomePath, 'utf8');
  genome = JSON.parse(raw);
} catch (err) {
  process.stderr.write(`Fatal: could not read/parse genome: ${err.message}\n`);
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusEmoji(proofClass) {
  switch (proofClass) {
    case 'contract_backed': return '✅';
    case 'violated':        return '⚠️';
    case 'aspirational':    return '🎯';
    default:                return '❓';
  }
}

function confidenceBar(c) {
  const filled = Math.round(c * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${Math.round(c * 100)}%`;
}

function bulletList(items) {
  return (items || []).map(i => `- ${i}`).join('\n');
}

// ─── Build output ─────────────────────────────────────────────────────────────

const lines = [];

lines.push(`# Semantic Genome — basicbrowserslim SPA`);
lines.push('');
lines.push(`> ${genome.description}`);
lines.push('');
lines.push(`**Version**: ${genome.version}  `);
lines.push(`**Base commit**: \`${genome.last_verified_commit || 'HEAD'}\``);
lines.push('');
lines.push('---');
lines.push('');

// ── Observable outputs ────────────────────────────────────────────────────────

lines.push('## Observable Outputs');
lines.push('');
lines.push('A transformation is valid only if every item below is preserved:');
lines.push('');
for (const obs of (genome.observables || [])) {
  lines.push(`- ${obs}`);
}
lines.push('');

// ── Phase grammar ─────────────────────────────────────────────────────────────

lines.push('## Phase Grammar');
lines.push('');
lines.push(`Allowed runtime phases: \`${(genome.phase_grammar || []).join(' | ')}\``);
lines.push('');
lines.push('No transition or pull may start while phase is non-idle.');
lines.push('');

// ── Genes ─────────────────────────────────────────────────────────────────────

lines.push('## Behavioral Genes');
lines.push('');
lines.push('Each gene is a named behavioral invariant. Genes marked ⚠️ are **not yet enforced** — they are targets for the next refactor pass.');
lines.push('');

const verified  = (genome.genes || []).filter(g => g.proof_class !== 'violated');
const violated  = (genome.genes || []).filter(g => g.proof_class === 'violated');

if (verified.length > 0) {
  lines.push('### Verified Invariants');
  lines.push('');
  for (const gene of verified) {
    lines.push(`#### ${statusEmoji(gene.proof_class)} \`${gene.id}\` — ${gene.subject}`);
    lines.push('');
    lines.push(`**Confidence**: ${confidenceBar(gene.confidence)}`);
    lines.push('');
    lines.push(gene.statement);
    lines.push('');
    lines.push(`**Observable effect**: ${gene.observable_effect}`);
    lines.push('');
    const evRefs = (gene.evidence || []).map(e => `\`${e.ref}\``).join(', ');
    if (evRefs) lines.push(`**Evidence**: ${evRefs}`);
    lines.push('');
    lines.push('**Invalidated by**:');
    lines.push(bulletList(gene.invalidated_by));
    lines.push('');
    lines.push('---');
    lines.push('');
  }
}

if (violated.length > 0) {
  lines.push('### Aspirational Invariants (currently violated)');
  lines.push('');
  lines.push('These invariants describe the target state. They are not yet enforced in the current codebase and represent the next concrete refactor pass.');
  lines.push('');
  for (const gene of violated) {
    lines.push(`#### ${statusEmoji(gene.proof_class)} \`${gene.id}\` — ${gene.subject}`);
    lines.push('');
    lines.push(`**Confidence when achieved**: ${confidenceBar(gene.confidence)}`);
    lines.push('');
    lines.push(gene.statement);
    lines.push('');
    lines.push(`**Observable effect**: ${gene.observable_effect}`);
    lines.push('');

    if ((gene.violated_at || []).length > 0) {
      lines.push('**Current violations**:');
      for (const v of gene.violated_at) {
        lines.push(`- \`${v.ref}\` — ${v.note}`);
      }
      lines.push('');
    }

    if (gene.remediation) {
      lines.push(`**Remediation**: ${gene.remediation}`);
      lines.push('');
    }

    lines.push('**Will be invalidated by**:');
    lines.push(bulletList(gene.invalidated_by));
    lines.push('');
    lines.push('---');
    lines.push('');
  }
}

// ── Transform laws ────────────────────────────────────────────────────────────

lines.push('## Transform Laws');
lines.push('');
lines.push('A transform law describes a category of refactor that is **behavior-preserving** when its required genes are verified.');
lines.push('Before applying a law, confirm every gene in `requires_genes` by inspecting the cited evidence lines.');
lines.push('');

for (const law of (genome.transform_laws || [])) {
  const geneList = (law.requires_genes || []).map(g => `\`${g}\``).join(', ');
  lines.push(`### \`${law.id}\` — ${law.name}`);
  lines.push('');
  lines.push(`**Requires genes**: ${geneList}`);
  lines.push('');
  lines.push(law.statement);
  lines.push('');
  lines.push(`**Witness**: ${law.witness}`);
  lines.push('');
  lines.push('---');
  lines.push('');
}

// ── LLM usage instructions ────────────────────────────────────────────────────

lines.push('## Instructions for LLM Static Recompilation');
lines.push('');
lines.push('When generating or transforming code in this repository:');
lines.push('');
lines.push('1. **Preserve all observables.** Any transformation that changes a listed observable is a behavioral regression.');
lines.push('2. **Respect the phase grammar.** Code must never leave `_phase` in a non-idle state after a transition completes or throws.');
lines.push('3. **Verify genes before applying laws.** Read the evidence lines for every gene in `requires_genes` before applying a transform law.');
lines.push('4. **Do not fix violated genes speculatively.** Genes with ⚠️ are tracked but require coordinated multi-file changes. Apply only the specific remediation described.');
lines.push('5. **Update this genome when evidence lines shift.** Run `node scripts/check-semantic-genome.js` after any refactor to confirm evidence refs are still valid.');
lines.push('6. **Export an updated prompt contract after each pass.** Run `node scripts/export-genome-prompt.js --out genome-prompt.md` to regenerate this file.');
lines.push('');
lines.push('---');
lines.push('');
lines.push(`*Generated by \`scripts/export-genome-prompt.js\` from \`js/spa/semantic-genome.json\` v${genome.version}.*`);
lines.push('');

// ─── Output ───────────────────────────────────────────────────────────────────

const output = lines.join('\n');

if (outPath) {
  const absOut = path.resolve(repoRoot, outPath);
  fs.writeFileSync(absOut, output, 'utf8');
  process.stderr.write(`Wrote ${output.length} chars to ${absOut}\n`);
} else {
  process.stdout.write(output);
}
