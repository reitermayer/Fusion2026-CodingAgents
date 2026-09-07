#!/usr/bin/env node
/**
 * Batch runner for the three-phase triage lab (Chapter 11).
 *
 * Reads Data/TriageBatch.csv and starts one `uip maestro flow debug` per ticket,
 * passing ticketId, phase and emailBody as flow inputs. Runs are STARTED one at
 * a time (two simultaneous uploads of the same project overwrite each other's
 * debug package and fail with a concurrency error) but they RUN concurrently:
 * the next upload begins as soon as the previous run's instance is Running,
 * so all nine tasks end up waiting in Action Center together. Each run pauses
 * on its Triage Review task (V1) until the reviewer actions it, then completes
 * and its payload is saved under TutorialSolution/.batch-runs/phase<N>/<TicketId>.json.
 *
 * Usage:
 *   node scripts/run-batch.js --phase 1                 # all nine tickets
 *   node scripts/run-batch.js --phase 1 --tickets T01,T02
 *   node scripts/run-batch.js --phase 2 --project EmailTriage --solution TutorialSolution
 *
 * No dependencies beyond Node.js and a logged-in `uip`.
 */
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*|^ \* ?/gm, ''));
  process.exit(0);
}
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const phase = Number(opt('phase', '1'));
const solution = opt('solution', 'TutorialSolution');
const project = opt('project', 'EmailTriage');
const only = opt('tickets', '').split(',').filter(Boolean);
const csvPath = opt('batch', path.join('Data', 'TriageBatch.csv'));
let folderKey = opt('folder-key', '');

if (![1, 2, 3].includes(phase)) {
  console.error(`--phase must be 1, 2 or 3 (got "${opt('phase')}")`);
  process.exit(2);
}

// Minimal RFC 4180 CSV parser: quoted fields, doubled quotes, CRLF or LF.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.length > 1);
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const tickets = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  .filter(t => only.length === 0 || only.includes(t.TicketId));
if (tickets.length === 0) {
  console.error(`No tickets selected from ${csvPath}`);
  process.exit(2);
}

const outDir = path.join(solution, '.batch-runs', `phase${phase}`);
fs.mkdirSync(outDir, { recursive: true });

function runOne(t) {
  return new Promise(resolve => {
    const inputs = JSON.stringify({ ticketId: t.TicketId, phase, emailBody: t.Body });
    const child = spawn('uip', ['maestro', 'flow', 'debug', project, '--inputs', inputs, '--output', 'json'],
      { cwd: solution, shell: process.platform === 'win32' });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', code => {
      const file = path.join(outDir, `${t.TicketId}.json`);
      fs.writeFileSync(file, out);
      resolve({ ticket: t.TicketId, code, file, out });
    });
  });
}

function uipJson(argv) {
  const out = execFileSync('uip', argv, { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'ignore'] });
  const lines = out.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === '{');
  return JSON.parse(lines.slice(start).join('\n'));
}

// Debug runs live in the user's personal workspace folder. Find its key once.
function detectFolderKey() {
  try {
    const me = uipJson(['user', '--output', 'json']).Data;
    const folders = uipJson(['or', 'folders', 'list', '--limit', '200', '--output', 'json']).Data || [];
    const mine = folders.find(f => f.Type === 'Personal' && f.Name && f.Name.toLowerCase().startsWith((me.Email || me.Name).toLowerCase()))
      || folders.find(f => f.Type === 'Personal');
    return mine ? mine.Key : '';
  } catch (e) { return ''; }
}

function instanceIds() {
  if (!folderKey) return null;
  try {
    const d = uipJson(['maestro', 'flow', 'instance', 'list', '--folder-key', folderKey, '--limit', '40', '--output', 'json']);
    const items = Array.isArray(d.Data) ? d.Data : (d.Data && (d.Data.Items || d.Data.value)) || [];
    return new Set(items.map(i => i.InstanceId));
  } catch (e) { return null; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Start one run, then wait until a new instance id shows up in the workspace
// (whatever its status: a fast reviewer may already have completed it), or 3 minutes pass.
async function startStaggered(t, known) {
  const promise = runOne(t);
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    await sleep(10000);
    const ids = instanceIds();
    if (ids === null) { console.log(`  ${t.TicketId}: could not read the instance list, continuing after a fixed wait`); await sleep(50000); return promise; }
    const fresh = [...ids].filter(id => !known.has(id));
    if (fresh.length) { fresh.forEach(id => known.add(id)); console.log(`  ${t.TicketId}: instance ${fresh[0]} started`); return promise; }
  }
  console.log(`  ${t.TicketId}: no new instance after 3 minutes (the upload probably failed), starting the next one anyway`);
  return promise;
}

function summarize(r) {
  const lines = r.out.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === '{');
  let status = `exit ${r.code}`, category = '', confidence = '', outcome = '', error = '';
  try {
    const d = JSON.parse(lines.slice(start).join('\n'));
    const D = d.Data || d;
    status = D.finalStatus || d.Result || status;
    const g = (D.variables && D.variables.globals) || {};
    category = g.category ?? '';
    confidence = g.confidence ?? '';
    outcome = g.reviewOutcome ?? '';
    const errs = Object.entries(g).filter(([k, v]) => k.endsWith('.error') && v);
    if (errs.length) error = errs.map(([k, v]) => `${k}: ${(v.message || JSON.stringify(v)).slice(0, 60)}`).join('; ');
    if (d.Result && d.Result !== 'Success') error = (d.Message || '').slice(0, 80);
  } catch (e) { error = 'payload not parsed'; }
  return { ticket: r.ticket, status, category, confidence, outcome, error };
}

(async () => {
  console.log(`Phase ${phase}: starting ${tickets.length} run(s) of ${project}, one upload at a time. Each run waits on its Triage Review task until it is actioned in Action Center.`);
  const t0 = Date.now();
  if (!folderKey) folderKey = detectFolderKey();
  console.log(folderKey ? `Personal workspace folder: ${folderKey}` : 'Personal workspace folder not found (pass --folder-key); falling back to fixed waits between uploads.');
  const known = instanceIds() || new Set();
  const promises = [];
  for (const t of tickets) promises.push(await startStaggered(t, known));
  console.log(`All ${tickets.length} run(s) started after ${Math.round((Date.now() - t0) / 1000)} s. Review the tasks in Action Center; the summary prints when the last run completes.`);
  const results = await Promise.all(promises);
  const rows = results.map(summarize);
  const w = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
  console.log('\n' + [w('Ticket', 7), w('Status', 10), w('Category', 28), w('Conf', 5), w('Outcome', 9), 'Error'].join(' | '));
  console.log('-'.repeat(90));
  for (const r of rows) console.log([w(r.ticket, 7), w(r.status, 10), w(r.category, 28), w(r.confidence, 5), w(r.outcome, 9), r.error].join(' | '));
  console.log(`\nPayloads: ${outDir}/<TicketId>.json   (${Math.round((Date.now() - t0) / 1000)} s wall clock)`);
  process.exit(rows.some(r => r.status !== 'Completed') ? 1 : 0);
})();
