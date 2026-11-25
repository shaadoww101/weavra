// Weavra — deployable backend
// Node 20+ / Express, JSON-file persistence, provider-agnostic LLM layer.
// Providers: OpenAI, Anthropic, Cohere via env vars. No key => DEMO MODE
// (grounded answers built from seeded knowledge, clearly labelled, never
// pretending to be live AI).
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_FILE = process.env.DATA_FILE || (process.env.VERCEL ? path.join('/tmp', 'weavra-db.json') : path.join(__dirname, 'data', 'db.json'));
const LLM_PROVIDER_ENV = (process.env.LLM_PROVIDER || '').toLowerCase();
const LLM_MODEL = process.env.LLM_MODEL || '';
function modelFor(provider, fallback) {
  if (LLM_MODEL) return LLM_MODEL;
  if (provider === 'openai') return process.env.OPENAI_MODEL || fallback;
  if (provider === 'anthropic') return process.env.ANTHROPIC_MODEL || fallback;
  if (provider === 'cohere') return process.env.COHERE_MODEL || fallback;
  return fallback;
}
function llmProvider() {
  // Explicit choice wins; otherwise auto-detect from whichever key is set;
  // with no key at all, OpenAI is the primary/default provider (demo mode
  // until OPENAI_API_KEY is set).
  if (LLM_PROVIDER_ENV) return LLM_PROVIDER_ENV;
  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) return 'anthropic';
  if (process.env.COHERE_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) return 'cohere';
  return 'openai';
}
function llmKey() {
  const p = llmProvider();
  if (p === 'openai') return process.env.OPENAI_API_KEY || '';
  if (p === 'anthropic') return process.env.ANTHROPIC_API_KEY || '';
  if (p === 'cohere') return process.env.COHERE_API_KEY || '';
  return '';
}
const LIVE = () => Boolean(llmProvider() && llmKey());
const MODE = () => (LIVE() ? 'live' : 'demo');

// ---------- Seed data (verbatim from the Weavra designs) ----------
const SEED_AGENTS = [
  { id: 'atlas', name: 'Atlas', role: 'Research Intelligence', category: 'Research', price: 'From $4 / task', color: '#c8f169', initial: 'A', description: 'Turns complex questions and scattered sources into concise research briefs, competitor scans and decision-ready insights.', instructions: 'You are Atlas, a careful research agent. Structure answers with key findings, evidence, and implications. Be concise and decision-ready. Say what you do not know.', tools: ['Web search', 'Knowledge retrieval', 'Calculator'] },
  { id: 'quill', name: 'Quill', role: 'Content & Campaign Studio', category: 'Marketing', price: 'From $2.50 / task', color: '#91e1c1', initial: 'Q', description: 'Creates brand-aware content, campaign concepts, email sequences and social calendars built around your audience.', instructions: 'You are Quill, a brand-aware content agent. Write in a clear, engaging voice. Offer a headline option, the draft, and a short rationale. Ask about the audience when it is missing.', tools: ['Knowledge retrieval', 'Web search'] },
  { id: 'relay', name: 'Relay', role: 'Workflow Operator', category: 'Operations', price: 'From $5 / task', color: '#b6a5ff', initial: 'R', description: 'Maps repetitive processes into practical automations, SOPs and reliable handoffs between your tools and team.', instructions: 'You are Relay, an operations agent. Break processes into numbered steps with owners, inputs, outputs, and approval points. Prefer practical, repeatable SOPs.', tools: ['Knowledge retrieval', 'Calendar', 'Email actions'] },
  { id: 'nova', name: 'Nova', role: 'Developer Copilot', category: 'Development', price: 'From $6 / task', color: '#8fb8ff', initial: 'N', description: 'Helps product teams reason through technical questions, plan features and create implementation-ready documentation.', instructions: 'You are Nova, a developer copilot. Give concrete implementation steps, trade-offs, and risks. Use code snippets only when they clarify. Keep docs implementation-ready.', tools: ['Code interpreter', 'Knowledge retrieval', 'HTTP / API request'] },
  { id: 'signal', name: 'Signal', role: 'Data & Insight Analyst', category: 'Research', price: 'From $3.50 / task', color: '#ffb27f', initial: 'S', description: 'Finds patterns in structured information and turns metrics into clear summaries, visual narratives and next steps.', instructions: 'You are Signal, a data analyst agent. Lead with the pattern, quantify it when numbers are given, and end with recommended next steps. Never invent numbers the user did not provide.', tools: ['Calculator', 'Code interpreter', 'Knowledge retrieval'] },
  { id: 'pulse', name: 'Pulse', role: 'Growth Strategist', category: 'Marketing', price: 'From $4.50 / task', color: '#b6a5ff', initial: 'P', description: 'Shapes customer acquisition experiments, conversion improvements and practical growth roadmaps for ambitious teams.', instructions: 'You are Pulse, a growth strategist. Prioritize experiments by impact and effort, define the metric each one moves, and give a practical 2-week action plan when asked for a roadmap.', tools: ['Web search', 'Knowledge retrieval', 'Calculator'] },
];

const SEED_KNOWLEDGE = [
  { id: 1, title: 'Company handbook — Refund policy', collection: 'Company handbook', content: 'Our standard refund policy allows customers to request a refund within 30 days of purchase. Items must be in their original condition. Refunds are processed to the original payment method within 5 to 10 business days.' },
  { id: 2, title: 'Product documentation — Workspaces', collection: 'Product documentation', content: 'Weavra workspaces let teams create specialized AI agents, connect approved knowledge collections, configure tools, and compose multi-step workflows. Agent owners define instructions and permissions.' },
  { id: 3, title: 'Sales playbook — Qualification', collection: 'Sales playbook', content: 'Our sales process has four stages: discovery, qualification, solution design, and proposal. Qualify leads by understanding the business problem, urgency, decision process, and desired outcome.' },
  { id: 4, title: 'Atlas — Research brief method', collection: 'Atlas — Research', content: 'Atlas research briefs follow: 1) State the decision question in one sentence. 2) List sources consulted and how recent they are. 3) Key findings with evidence. 4) What is uncertain or missing. 5) Recommendation and next step. A competitor scan covers positioning, pricing, strengths, weaknesses, and what customers say. Never present a guess as a verified fact — label confidence as high, medium, or low.' },
  { id: 5, title: 'Atlas — Evaluating sources', collection: 'Atlas — Research', content: 'Check a source before citing it: who published it, when, what evidence it gives, and whether another independent source agrees. Prefer primary sources and recent data for fast-moving topics. If two sources disagree, report both and explain the difference. If no supporting source is found, say so and ask for an approved source instead of inventing one.' },
  { id: 6, title: 'Quill — Brand voice and campaign structure', collection: 'Quill — Content', content: 'Quill campaigns start with audience, promise, and one call to action. Structure: headline, hook, 3 supporting points, proof, and clear next step. Keep voice clear, warm, and direct — no jargon unless the audience uses it. Every draft includes a headline option, the draft itself, and a short rationale for why it fits the audience.' },
  { id: 7, title: 'Quill — SEO and content calendar', collection: 'Quill — Content', content: 'For SEO content, start from the search question, answer it in the first paragraph, then add detail, examples, and a FAQ. Use one primary keyword naturally, descriptive headings, and internal links to related Weavra pages. A content calendar lists topic, audience, channel, format, owner, and publish date — plan 2 weeks ahead and reuse one core idea across email, social, and blog.' },
  { id: 8, title: 'Relay — SOP format', collection: 'Relay — Operations', content: 'A Relay SOP has: purpose, owner, trigger, inputs, numbered steps, expected output, approval point, and what to do if a step fails. Write steps as one action per line, name the person or role responsible, and state the handoff: who receives the output and by when. Review SOPs when the process, tool, or owner changes.' },
  { id: 9, title: 'Relay — Process mapping and automation', collection: 'Relay — Operations', content: 'Map a process before automating it: list every step, who does it, how long it takes, and where work waits or repeats. Automate the repetitive, rule-based steps first and keep a human approval for external, destructive, or customer-facing actions. Log every automated action so it can be reviewed.' },
  { id: 10, title: 'Nova — Feature planning', collection: 'Nova — Development', content: 'Nova plans a feature as: problem, users affected, success criteria, scope in / out, technical approach, risks, and testing plan. Break work into small, testable steps with acceptance criteria for each. Prefer the simplest approach that meets the criteria, and name trade-offs explicitly — speed vs. quality, flexibility vs. complexity.' },
  { id: 11, title: 'Nova — Code review and debugging', collection: 'Nova — Development', content: 'Code review checks: does it meet the acceptance criteria, handle edge cases and errors, follow existing patterns, and include tests or docs where needed. Debugging steps: reproduce the issue, narrow the change that caused it, check inputs and logs, fix the smallest cause, and add a test that would catch it again. Document decisions in the code or docs, not only in chat.' },
  { id: 12, title: 'Signal — Reading metrics', collection: 'Signal — Data', content: 'Signal leads with the pattern, then the numbers that support it, then what to do next. Quantify change as absolute and percentage, state the time period and sample, and compare to a baseline. Never invent numbers — if no data was provided, say what data is needed. A single metric without context is not an insight.' },
  { id: 13, title: 'Signal — Reporting structure', collection: 'Signal — Data', content: 'A Signal report has: headline finding, 2-3 supporting metrics, what changed and why it matters, limitations, and recommended next steps. Use plain language, define any metric the reader may not know, and separate what the data shows from what it suggests. End with one clear recommendation, not five.' },
  { id: 14, title: 'Pulse — Growth experiments', collection: 'Pulse — Growth', content: 'A Pulse experiment has: hypothesis, audience, metric it should move, change to test, effort (low/medium/high), and how long to run it. Prioritize by impact divided by effort. Run one variable at a time, define success before starting, and stop or scale based on the result — do not keep a losing test running.' },
  { id: 15, title: 'Pulse — Funnel and conversion', collection: 'Pulse — Growth', content: 'The funnel is: discovery, interest, trial or signup, activation, and retention. At each stage, name the drop-off, the likely friction, and one fix to test. Conversion levers include clearer value in the headline, fewer form fields, social proof, a strong call to action, and faster follow-up. A 2-week roadmap lists 3 experiments, owners, and the metric for each.' },
];

function seedWorkflows() {
  return [
    { id: 'wf-lead', name: 'Lead qualification', steps: [
      { type: 'Trigger', title: 'New lead arrives', desc: 'A new request starts the workflow', agent: '' },
      { type: 'Knowledge', title: 'Check sales playbook', desc: 'Retrieve qualification stages from the sales playbook', agent: '' },
      { type: 'Agent', title: 'Atlas researches the lead', desc: 'Research the lead company and market', agent: 'Atlas' },
      { type: 'Agent', title: 'Signal scores the lead', desc: 'Find patterns in the lead data and score it', agent: 'Signal' },
      { type: 'Approval', title: 'Human review', desc: 'Approve before any outreach', agent: '' },
      { type: 'Output', title: 'Send qualification summary', desc: 'Deliver the final qualification summary', agent: '' },
    ]},
    { id: 'wf-launch', name: 'Product launch plan', steps: [
      { type: 'Trigger', title: 'Launch brief received', desc: 'A launch brief starts the workflow', agent: '' },
      { type: 'Agent', title: 'Atlas researches market', desc: 'Research the market and competitors', agent: 'Atlas' },
      { type: 'Agent', title: 'Signal finds audience insights', desc: 'Find audience insights from data', agent: 'Signal' },
      { type: 'Agent', title: 'Quill writes launch messaging', desc: 'Write launch messaging and campaign', agent: 'Quill' },
      { type: 'Agent', title: 'Pulse plans growth experiments', desc: 'Plan growth experiments for launch', agent: 'Pulse' },
      { type: 'Approval', title: 'Approve launch plan', desc: 'Approve the launch plan before delivery', agent: '' },
      { type: 'Output', title: 'Deliver launch plan', desc: 'Deliver the final launch plan', agent: '' },
    ]},
    { id: 'wf-onboarding', name: 'Customer onboarding', steps: [
      { type: 'Trigger', title: 'New customer signs up', desc: 'A new customer signs up', agent: '' },
      { type: 'Knowledge', title: 'Check product documentation', desc: 'Retrieve product documentation', agent: '' },
      { type: 'Agent', title: 'Relay maps onboarding steps', desc: 'Map the onboarding steps into an SOP', agent: 'Relay' },
      { type: 'Agent', title: 'Nova prepares setup docs', desc: 'Prepare technical setup documentation', agent: 'Nova' },
      { type: 'Agent', title: 'Quill drafts welcome sequence', desc: 'Draft the welcome email sequence', agent: 'Quill' },
      { type: 'Approval', title: 'Approve onboarding pack', desc: 'Approve the onboarding pack', agent: '' },
      { type: 'Output', title: 'Send onboarding pack', desc: 'Send the final onboarding pack', agent: '' },
    ]},
  ];
}

// ---------- Persistence (JSON file, seeded on first run) ----------
function loadDb() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('DB read failed, re-seeding:', e.message); }
  const db = { agents: SEED_AGENTS, knowledge: SEED_KNOWLEDGE, workflows: seedWorkflows(), waitlist: [], runs: [], nextKnowledgeId: 16, nextRunId: 1 };
  saveDb(db);
  return db;
}
function saveDb(db) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (e) { console.error('DB write failed (continuing in-memory):', e.message); }
}
let db = loadDb();

// ---------- RAG: keyword retrieval ----------
const STOP = new Set('a,an,the,is,are,was,were,what,how,why,when,where,who,which,can,could,should,would,do,does,did,of,to,in,on,for,and,or,our,your,my,me,i,us,we,it,its,this,that,with,from,by,at,as,be,have,has,had,not,no,yes,please,tell,me,about,give,show,explain'.split(','));
function tokens(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP.has(t)); }
function retrieve(query, agentName, topK = 3) {
  const qt = new Set(tokens(query));
  if (!qt.size) return [];
  const scored = db.knowledge.map(doc => {
    const hay = (doc.title + ' ' + doc.collection + ' ' + doc.content).toLowerCase();
    let tokenScore = 0;
    for (const t of qt) if (hay.includes(t)) tokenScore += 1;
    if (tokenScore === 0) return null; // never return a doc with no keyword match
    let score = tokenScore;
    // Boost the selected agent's own collection and exact title matches
    if (agentName && doc.collection.toLowerCase().startsWith(agentName.toLowerCase())) score += 2;
    if (agentName && doc.title.toLowerCase().includes(agentName.toLowerCase())) score += 1;
    return { doc, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, topK);
  return scored.map(x => ({ id: x.doc.id, title: x.doc.title, collection: x.doc.collection, content: x.doc.content, score: x.score }));
}

// ---------- LLM layer (provider-agnostic) ----------
async function callLlm(agent, message, contextDocs) {
  const provider = llmProvider();
  const key = llmKey();
  const context = contextDocs.map(d => `[${d.title} — ${d.collection}]\n${d.content}`).join('\n\n');
  const system = `${agent.instructions}\n\nYou are ${agent.name}, ${agent.role} at Weavra. Answer only from the knowledge below when it is relevant. If the knowledge does not cover the question, say so clearly instead of inventing details.\n\nKNOWLEDGE:\n${context || '(no matching knowledge retrieved)'}`;
  if (provider === 'openai') {
    const model = modelFor('openai', 'gpt-4o-mini');
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: message }], temperature: 0.3 }) });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return j.choices?.[0]?.message?.content || '';
  }
  if (provider === 'anthropic') {
    const model = modelFor('anthropic', 'claude-sonnet-4-20250514');
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 1024, system, messages: [{ role: 'user', content: message }] }) });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return (j.content || []).map(c => c.text || '').join('');
  }
  if (provider === 'cohere') {
    const model = modelFor('cohere', 'command-a-03-2025');
    const r = await fetch('https://api.cohere.com/v2/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: message }] }) });
    if (!r.ok) throw new Error(`Cohere ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return j.message?.content?.map(c => c.text || '').join('') || '';
  }
  throw new Error('No LLM provider configured');
}

function demoAnswer(agent, message, docs) {
  if (!docs.length) {
    return 'I could not find that in the knowledge base — not covered in the knowledge base. Add an approved source in the Knowledge Base, or ask about refunds, workspaces, sales qualification, research, content, SOPs, feature planning, metrics, or growth experiments.';
  }
  const lines = docs.map(d => `• ${d.title}: ${d.content}`).join('\n');
  return `${agent.name} (DEMO MODE — grounded in the seeded knowledge base):\n\n${lines}\n\nIn live mode with an LLM key set, ${agent.name} would turn this into a fuller answer in its own voice.`;
}

async function answerWithAgent(agent, message, grounded = true) {
  const docs = grounded ? retrieve(message, agent.name, 3) : [];
  const citations = docs.map(d => ({ id: d.id, title: d.title, collection: d.collection }));
  if (grounded && !docs.length) {
    return { answer: demoAnswer(agent, message, []), citations: [], mode: MODE(), agent: agent.name };
  }
  if (LIVE()) {
    try {
      const answer = await callLlm(agent, message, docs);
      return { answer, citations, mode: 'live', agent: agent.name };
    } catch (e) {
      console.error('LLM call failed, falling back to demo:', e.message);
      return { answer: demoAnswer(agent, message, docs) + `\n\n(Live call failed: ${e.message}. Showing the grounded demo answer instead.)`, citations, mode: 'demo', agent: agent.name, llmError: e.message };
    }
  }
  return { answer: demoAnswer(agent, message, docs), citations, mode: 'demo', agent: agent.name };
}

// ---------- Workflow execution ----------
async function executeRun(run) {
  const wf = db.workflows.find(w => w.id === run.workflowId);
  if (!wf) { run.status = 'failed'; run.log.push('[ERROR] Workflow not found.'); saveDb(db); return run; }
  run.status = 'running';
  while (run.currentStep < wf.steps.length) {
    const step = wf.steps[run.currentStep];
    const n = run.currentStep + 1;
    if (step.type === 'Approval') {
      run.status = 'waiting_approval';
      run.log.push(`[PAUSED] Step ${n} "${step.title}" — waiting for human approval.`);
      saveDb(db);
      return run;
    }
    if (step.type === 'Trigger') {
      run.log.push(`[STEP ${n}] Trigger: ${step.title} — ${step.desc}`);
      run.results.push({ step: n, title: step.title, type: step.type, output: step.desc });
    } else if (step.type === 'Knowledge') {
      const docs = retrieve(step.title + ' ' + step.desc, '', 3);
      const cited = docs.map(d => d.title).join(', ') || 'no matching document';
      run.log.push(`[STEP ${n}] Knowledge: ${step.title} — retrieved: ${cited}`);
      run.results.push({ step: n, title: step.title, type: step.type, output: `Retrieved: ${cited}`, citations: docs.map(d => ({ title: d.title, collection: d.collection })) });
    } else if (step.type === 'Agent') {
      const agent = db.agents.find(a => a.name === step.agent) || db.agents[0];
      const res = await answerWithAgent(agent, `${step.title}. ${step.desc}`, true);
      const snippet = res.answer.replace(/\n/g, ' ').slice(0, 280);
      run.log.push(`[STEP ${n}] ${agent.name}: ${step.title} — ${snippet}`);
      run.results.push({ step: n, title: step.title, type: step.type, agent: agent.name, output: res.answer, citations: res.citations, mode: res.mode });
    } else {
      run.log.push(`[STEP ${n}] ${step.type}: ${step.title} — ${step.desc}`);
      run.results.push({ step: n, title: step.title, type: step.type, output: step.desc });
    }
    run.currentStep += 1;
    saveDb(db);
  }
  run.status = 'completed';
  run.log.push('[DONE] Workflow completed.');
  saveDb(db);
  return run;
}

// ---------- API ----------
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true, mode: MODE(), provider: llmProvider() || null, agents: db.agents.length, knowledge: db.knowledge.length, workflows: db.workflows.length, waitlist: db.waitlist.length, timestamp: new Date().toISOString() }));
app.get('/api/mode', (req, res) => res.json({ mode: MODE(), provider: llmProvider() || null, live: LIVE() }));

app.get('/api/agents', (req, res) => res.json(db.agents));
app.get('/api/agents/:id', (req, res) => {
  const a = db.agents.find(x => x.id === req.params.id || x.name.toLowerCase() === req.params.id.toLowerCase());
  if (!a) return res.status(404).json({ error: 'Agent not found' });
  res.json(a);
});

app.get('/api/knowledge', (req, res) => res.json(db.knowledge));
app.post('/api/knowledge', (req, res) => {
  const { title, collection, content } = req.body || {};
  if (!title || !collection || !content) return res.status(400).json({ error: 'title, collection and content are required' });
  const doc = { id: db.nextKnowledgeId++, title: String(title).slice(0, 120), collection: String(collection).slice(0, 60), content: String(content) };
  db.knowledge.push(doc); saveDb(db);
  res.status(201).json(doc);
});

app.post('/api/chat', async (req, res) => {
  const { agent, message, grounded } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'message is required' });
  const name = String(agent || 'Atlas');
  const found = db.agents.find(a => a.name.toLowerCase() === name.toLowerCase() || a.id === name.toLowerCase()) || db.agents[0];
  try {
    const out = await answerWithAgent(found, String(message), grounded !== false);
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/workflows', (req, res) => res.json(db.workflows));
app.get('/api/workflows/:id', (req, res) => {
  const w = db.workflows.find(x => x.id === req.params.id);
  if (!w) return res.status(404).json({ error: 'Workflow not found' });
  res.json(w);
});
app.post('/api/workflows', (req, res) => {
  const { name, steps } = req.body || {};
  if (!name || !Array.isArray(steps) || !steps.length) return res.status(400).json({ error: 'name and a non-empty steps array are required' });
  const wf = { id: 'wf-' + Date.now().toString(36), name: String(name).slice(0, 80), steps: steps.map(s => ({ type: s.type || 'Agent', title: String(s.title || 'Step').slice(0, 80), desc: String(s.desc || ''), agent: s.agent || '' })) };
  db.workflows.push(wf); saveDb(db);
  res.status(201).json(wf);
});
app.get('/api/workflows/:id/runs', (req, res) => res.json(db.runs.filter(r => r.workflowId === req.params.id)));
app.post('/api/workflows/:id/run', async (req, res) => {
  const wf = db.workflows.find(w => w.id === req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });
  const run = { id: db.nextRunId++, workflowId: wf.id, workflowName: wf.name, status: 'running', currentStep: 0, log: [`[SYSTEM] Starting workflow "${wf.name}" (${MODE()} mode).`], results: [], createdAt: new Date().toISOString() };
  db.runs.push(run); saveDb(db);
  await executeRun(run);
  res.status(201).json(run);
});
app.post('/api/workflows/:id/approve', async (req, res) => {
  const runId = req.body?.runId;
  let run = runId ? db.runs.find(r => r.id === Number(runId)) : [...db.runs].reverse().find(r => r.workflowId === req.params.id && r.status === 'waiting_approval');
  if (!run) return res.status(404).json({ error: 'No run waiting for approval for this workflow' });
  if (run.status !== 'waiting_approval') return res.status(400).json({ error: `Run is ${run.status}, not waiting for approval` });
  run.log.push(`[APPROVED] Step ${run.currentStep + 1} approved by a human.`);
  run.currentStep += 1;
  saveDb(db);
  await executeRun(run);
  res.json(run);
});
app.get('/api/runs/:id', (req, res) => {
  const r = db.runs.find(x => x.id === Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'Run not found' });
  res.json(r);
});

app.get('/api/waitlist', (req, res) => res.json(db.waitlist));
app.post('/api/waitlist', (req, res) => {
  const { name, email, type } = req.body || {};
  if (!email || !String(email).includes('@')) return res.status(400).json({ error: 'A valid email is required' });
  const entry = { id: db.waitlist.length + 1, name: String(name || '').slice(0, 80), email: String(email).slice(0, 120), type: String(type || 'waitlist').slice(0, 40), createdAt: new Date().toISOString() };
  db.waitlist.push(entry); saveDb(db);
  res.status(201).json({ ok: true, entry });
});

// SPA fallback (after API routes)
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Weavra running on http://localhost:${PORT} — mode: ${MODE()}${LIVE() ? ` (provider: ${llmProvider()})` : ' (DEMO MODE — set LLM_PROVIDER + an API key for live AI)'}`);
  });
}
module.exports = app;
