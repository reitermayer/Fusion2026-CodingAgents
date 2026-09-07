#!/usr/bin/env node
/**
 * The escalation scoreboard for the three-phase triage lab (Chapter 11).
 *
 * Reads every TriageDecision row through `uip df records list` and prints, per
 * phase, how many rows carry each Outcome and how many of them a human touched:
 *
 *   escalations(phase) = Approved + Modified + Denied
 *
 * Usage:
 *   node scripts/scoreboard.js                # all phases 1..3
 *   node scripts/scoreboard.js --phase 2      # one phase, plus its rows
 *   node scripts/scoreboard.js --entity TriageDecision
 *
 * Phase 0 rows are test rows and are never counted.
 */
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const entityName = opt('entity', 'TriageDecision');
const onlyPhase = opt('phase', '');

const OUTCOMES = { 0: 'Auto', 1: 'Approved', 2: 'Modified', 3: 'Denied', 4: 'AutoResolved' };
const HUMAN = [1, 2, 3];

function uip(argv) {
  const out = execFileSync('uip', argv, { encoding: 'utf8', shell: process.platform === 'win32' });
  const lines = out.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === '{' || l.trim().startsWith('{"'));
  return JSON.parse(lines.slice(start).join('\n'));
}

const entities = uip(['df', 'entities', 'list', '--output', 'json']);
const entity = (entities.Data || []).find(e => e.Name === entityName);
if (!entity) {
  console.error(`Entity ${entityName} not found. Run Chapter 09 first.`);
  process.exit(2);
}

const page = uip(['df', 'records', 'list', entity.Id, '--limit', '1000', '--output', 'json']);
const rows = (page.Data && page.Data.Items) || [];

const phases = onlyPhase ? [Number(onlyPhase)] : [1, 2, 3];
const w = (s, n) => String(s ?? '').padEnd(n);
console.log(`${entityName}: ${rows.length} row(s), ${rows.filter(r => r.Phase === 0).length} of them Phase 0 test rows (ignored)\n`);
console.log([w('Phase', 6), w('Rows', 5), w('Auto', 5), w('Approved', 9), w('Modified', 9), w('Denied', 7), w('AutoResolved', 13), 'Escalations'].join(' | '));
console.log('-'.repeat(84));
for (const ph of phases) {
  const rs = rows.filter(r => Number(r.Phase) === ph);
  const count = id => rs.filter(r => Number(r.Outcome) === id).length;
  const esc = HUMAN.reduce((n, id) => n + count(id), 0);
  console.log([w(ph, 6), w(rs.length, 5), w(count(0), 5), w(count(1), 9), w(count(2), 9), w(count(3), 7), w(count(4), 13), rs.length ? `${esc} of ${rs.length}` : '-'].join(' | '));
}

if (onlyPhase) {
  const rs = rows.filter(r => Number(r.Phase) === Number(onlyPhase)).sort((a, b) => String(a.TicketId).localeCompare(String(b.TicketId)));
  console.log(`\nPhase ${onlyPhase} rows:`);
  console.log([w('Ticket', 7), w('Proposed', 26), w('Department', 26), w('Outcome', 13), w('Conf', 5), 'Feedback'].join(' | '));
  console.log('-'.repeat(100));
  for (const r of rs) console.log([w(r.TicketId, 7), w(r.ProposedDepartment, 26), w(r.Department, 26), w(OUTCOMES[r.Outcome] ?? r.Outcome, 13), w(r.Confidence, 5), (r.Feedback || '').slice(0, 40)].join(' | '));
}
