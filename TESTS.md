# Weavra deployable — what was verified

Verified locally on 2026-11-19, Node v24.22.1, no LLM key set (DEMO MODE, default provider `openai`).
See README.md for how to re-run each check in live mode (set `OPENAI_API_KEY`).

## Commands run and results

```bash
cd ~/workspace/weavra-deployable
npm install
# added 68 packages, no errors

PORT=3001 node server.js &
# Weavra running on http://localhost:3001 — mode: demo (DEMO MODE — set LLM_PROVIDER + an API key for live AI)

curl -s localhost:3001/api/health
# {"ok":true,"mode":"demo","provider":"openai","agents":6,"knowledge":15,"workflows":3,"waitlist":0,...}
# provider is "openai" (the default) even in demo mode; mode stays "demo" until OPENAI_API_KEY is set.

curl -s localhost:3001/api/agents | python3 -c "import json,sys; print([a['name'] for a in json.load(sys.stdin)])"
# ['Atlas', 'Quill', 'Relay', 'Nova', 'Signal', 'Pulse']

curl -s -X POST localhost:3001/api/chat -H 'Content-Type: application/json' \
  -d '{"agent":"Atlas","message":"What is our refund policy?"}'
# mode "demo", citations include {"title":"Company handbook — Refund policy","collection":"Company handbook"},
# answer quotes the 30-day / original-condition / 5-to-10-business-days policy.

curl -s -X POST localhost:3001/api/chat -H 'Content-Type: application/json' \
  -d '{"agent":"Atlas","message":"What is the capital of France?"}'
# answer: "I could not find that in the knowledge base — not covered in the knowledge base..."
# citations: []
# (Use a question sharing no keywords with any doc to test abstention — e.g.
# "What is our policy on moon bases?" shares the word "policy" with the
# handbook, so keyword retrieval legitimately returns the refund policy.)

curl -s -X POST localhost:3001/api/workflows/wf-lead/run -H 'Content-Type: application/json' -d '{}'
# status "waiting_approval", log ends "[PAUSED] Step 5 \"Human review\" — waiting for human approval."

curl -s -X POST localhost:3001/api/workflows/wf-lead/approve -H 'Content-Type: application/json' -d '{"runId":1}'
# status "completed", log ends "[DONE] Workflow completed."

curl -s -o /dev/null -w "%{http_code}" localhost:3001/
# 200 — frontend loads

curl -s -X POST localhost:3001/api/waitlist -H 'Content-Type: application/json' \
  -d '{"name":"Test Friend","email":"friend@example.com","type":"waitlist"}'
# {"ok":true,"entry":{"id":1,...}} — signup saved to data/db.json
```

## Frontend checks

- Opened http://localhost:3001/ — hero, agent grid (6 agents), chat picker (6 buttons),
  Knowledge Base panel, workflow builder with templates, and waitlist form all render.
- Chat via the UI uses the same POST /api/chat endpoint verified above.
- The mode badge shows “DEMO MODE — no LLM key set” when no key is configured.

## Not verified (needs a key / a host)

- Live LLM calls for OpenAI / Anthropic / Cohere (code paths implemented in
  server.js `callLlm`, but no key was used and none was requested).
- Docker build/run and Render deploy (Dockerfile, docker-compose.yml and
  render.yaml are provided and follow the standard Node 20 patterns, but were
  not executed in this environment).
- High-volume / concurrent use; the JSON-file store is demo-grade — see the
  security notes in README.md before sharing publicly in live mode.
- Retrieval is keyword/substring based: a shared word (e.g. "policy", "check")
  can surface a loosely related doc alongside the right one. The correct doc
  ranked first in every check above; for production use, replace it with
  embeddings + reranking.
