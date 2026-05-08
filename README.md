# Skills Dashboard

A self-hosted monitoring dashboard for tracking AI skills, Claude Code skills, and n8n automation workflows collected from external authors. Detects upstream updates, runs AI-powered security diff reviews, and tracks author credibility — all in a Docker container.

---

## What It Does

- **Tracks** every skill and workflow you use, who made it, and where you got it
- **Monitors** upstream git repos for changes on a weekly schedule (+ on-demand)
- **Reviews** every update with AI: plain-English summary, endpoint change detection, security assessment, and a SAFE / REVIEW / DO NOT MERGE recommendation
- **Profiles** authors automatically using the GitHub API and Firecrawl
- **Discovers** new skills by scanning a repo URL — finds SKILL.md files and n8n workflow JSONs automatically
- **Runs anywhere** via Docker — hand it to another team, they clone it, fill in `.env`, and `docker-compose up`

---

## Quick Start

### 1. Clone and configure

```bash
git clone <your-org/skills-dashboard>
cd skills-dashboard
cp .env.example .env
```

Edit `.env` and fill in at minimum:

```env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-6
```

### 2. Run with Docker

```bash
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Run without Docker (dev / manual)

```bash
npm install
npm run dev
```

---

## Configuration

### registry.config.json

This is the source of truth. It lives in the project root and is bind-mounted into the container so you can edit it directly on the host without rebuilding.

**AI agents can also edit this file directly** — the schema is intentional and self-documenting.

```jsonc
{
  "version": "1.0",
  "resources": [
    {
      "id": "my-skill",                          // Unique slug ID
      "name": "My Skill",                        // Display name
      "type": "claude-skill",                    // claude-skill | n8n-workflow | reference-kit | mixed
      "ownership_status": "external",            // external | monitored | vendored | internal
      "author_id": "author-key",                 // Key into the authors object below (or null)
      "upstream_git_url": "https://...",         // Git URL to track for updates (or null)
      "download_origin": "GitHub / Skool / ...", // Where you got it (for display)
      "category": "marketing",                   // Free-form category
      "notes": "What this does...",              // Description
      "skip_auto_update": false,                 // Set true to exclude from weekly scan
      "sub_resource_ids": [],                    // IDs of child resources (if any)
      "discovered_from": null                    // Set by auto-discovery — the source repo URL
    }
  ],
  "authors": {
    "author-key": {
      "name": "Author Name",
      "github": "githubusername",    // Used to fetch GitHub profile automatically
      "twitter": "twitterhandle",    // Used for Firecrawl enrichment (optional)
      "website": "https://..."       // Used for Firecrawl enrichment (optional)
    }
  }
}
```

**Ownership status lifecycle:**

| Status | Meaning |
|--------|---------|
| `external` | Cloned directly from someone else's repo. No fork. |
| `monitored` | You've forked it to your org and track upstream. |
| `vendored` | Forked and diverged — you own it, no longer tracking upstream. |
| `internal` | Built by your team from scratch. |

---

## AI Provider Setup

Set `AI_PROVIDER` in `.env` to one of the following:

### Anthropic (Claude) — recommended
```env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-6
```

### OpenAI
```env
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o
```

### Google Gemini
```env
AI_PROVIDER=gemini
AI_API_KEY=AIza...
AI_MODEL=gemini-2.0-flash
```

### OpenRouter (access any model)
```env
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-...
AI_MODEL=anthropic/claude-sonnet-4-6
# Other options: google/gemini-2.0-flash, meta-llama/llama-3.3-70b-instruct
```

### Local model (Ollama, vLLM, LM Studio, etc.)
```env
AI_PROVIDER=local
AI_API_KEY=none
AI_MODEL=llama3
AI_BASE_URL=http://host.docker.internal:11434/v1
# Use host.docker.internal instead of localhost inside Docker
```

---

## Firecrawl Setup (Optional)

Firecrawl powers author profile enrichment — it scrapes author websites and social profiles to generate "Why Trust" summaries. The dashboard works without it; author cards will show basic GitHub data only.

### Self-hosted Firecrawl
```env
FIRECRAWL_URL=http://your-firecrawl-server:3002
```

### Firecrawl Cloud
```env
FIRECRAWL_API_KEY=fc-...
```

---

## Adding Resources

### Option A — Auto-discover from a repo URL
1. Click **Add Resource** in the dashboard
2. Choose **Auto-Discover**
3. Paste a GitHub repo URL
4. The app clones it, finds all `SKILL.md` files and n8n workflow JSONs
5. Select which ones to import and confirm

### Option B — Edit registry.config.json directly
Add an entry to the `resources` array following the schema above. The dashboard picks it up on next load. No restart needed.

### Option C — Manual entry in the UI
Click **Add Resource** → **Manual Entry** and fill in the form.

---

## Scan Behavior

- **Weekly scan**: runs automatically on the cron defined by `SCAN_SCHEDULE` (default: Sunday 02:00)
- **Scan All**: click the button in the header to run all non-skipped resources immediately
- **Check Now**: click the refresh icon on any card to scan that resource individually
- **After merge**: after clicking Merge & Update, the card auto-re-scans to confirm sync

### Security Recommendations

Each scan with upstream changes produces one of three recommendations:

| Recommendation | Meaning | What to do |
|---|---|---|
| `SAFE_TO_MERGE` | Routine update, known vendors, additive changes | Click Merge & Update |
| `HUMAN_REVIEW_NEEDED` | Endpoint changes to different domains, logic rewrites | Read the diff, verify manually, then merge |
| `DO_NOT_MERGE` | Unknown domains, suspicious patterns, exposed credentials | Do not merge. Investigate. Consider abandoning the upstream. |

---

## Docker Volume Notes

| Volume / Mount | What it stores |
|---|---|
| `repos/` (named volume) | Cloned git repositories, managed by the container |
| `data/` (named volume) | `scan-results.json` and `authors.json` — persists across restarts |
| `./registry.config.json` (bind mount) | Your resource list — edit on the host, changes are live |

To back up your data:
```bash
docker cp skills-dashboard:/app/data ./backup-data
```

---

## Handing Off to Another Team

1. They clone your repo (or a fork of it)
2. They copy `.env.example` → `.env` and fill in their API keys and model
3. They replace `registry.config.json` with their own resource list (or start from scratch)
4. `docker-compose up -d`

Their repos and scan data are stored in their own named Docker volumes. Nothing is shared between deployments.

---

## Architecture

```
skills-dashboard/
├── registry.config.json     ← Edit this to add/modify resources
├── data/
│   ├── scan-results.json    ← Written by scanner, read by UI
│   └── authors.json         ← Author profile cache
├── app/
│   ├── page.tsx             ← Main dashboard (client component)
│   └── api/
│       ├── scan/            ← GET: history | POST: scan all
│       ├── scan/[id]/       ← POST: scan single resource
│       ├── merge/[id]/      ← POST: merge upstream into local
│       ├── registry/        ← GET/PUT: read/write registry
│       ├── authors/         ← GET/POST: read/refresh author cache
│       └── discover/        ← POST: discover or confirm from repo URL
├── lib/
│   ├── ai-client.ts         ← Provider-agnostic AI completion
│   ├── scanner.ts           ← Core scan orchestration
│   ├── git-ops.ts           ← Git clone / fetch / diff / merge
│   ├── endpoint-extractor.ts← URL extraction from diffs
│   ├── ai-reviewer.ts       ← Sends diffs to AI for review
│   ├── author-lookup.ts     ← GitHub API + Firecrawl enrichment
│   ├── n8n-parser.ts        ← Parses n8n workflow JSON files
│   ├── discovery.ts         ← Auto-discovers skills in a repo
│   ├── registry.ts          ← Read/write registry.config.json
│   └── scheduler.ts         ← node-cron weekly job
├── components/
│   ├── ResourceCard.tsx     ← Card with expandable dropdown
│   ├── UpdatePanel.tsx      ← Diff + AI review + action buttons
│   ├── AuthorPanel.tsx      ← Author info and social links
│   ├── DiffViewer.tsx       ← Syntax-highlighted diff display
│   └── AddResourceModal.tsx ← Auto-discover or manual add flow
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Development

```bash
npm install
npm run dev
```

The scheduler only runs in `production` mode (`NODE_ENV=production`) to avoid double-runs during development with hot reload.

To test scanning locally without Docker, make sure `git` is installed and run:
```bash
npm run dev
# Then POST to http://localhost:3000/api/scan/ugc-factory-skill
```
