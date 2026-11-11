# VALORANT Discord Match Notifier

Architecture:
- `docs/`: GitHub Pages frontend
- `worker/`: Cloudflare Worker API + D1 schema
- `.github/workflows/`: scheduled GitHub Actions runner
- `bot/`: Python polling entry point

## Important
This is an infrastructure starter, not a working Riot integration yet.
Real VALORANT account linking requires Riot Sign On (RSO) approval and an approved VALORANT Production API key. Do not collect Riot passwords or store copied Riot session tokens.

## 1. Upload to GitHub
Upload the contents of this folder to the root of your empty GitHub repository.
Do not upload secrets or a `.env` file.

## 2. Enable GitHub Pages
Repository → Settings → Pages
- Build and deployment: Deploy from a branch
- Branch: `main`
- Folder: `/docs`
Save. The site will appear at `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

## 3. Create Cloudflare D1
Install Wrangler locally:
```bash
npm install -g wrangler
wrangler login
```
From the `worker/` directory:
```bash
wrangler d1 create valorant-notifier
```
Copy the returned database ID into `worker/wrangler.toml` replacing `REPLACE_WITH_D1_DATABASE_ID`.
Then:
```bash
wrangler d1 execute valorant-notifier --remote --file= schema.sql
```
If the command above rejects the space after `--file=`, use:
```bash
wrangler d1 execute valorant-notifier --remote --file=schema.sql
```

## 4. Configure and deploy the Worker
From `worker/`:
```bash
wrangler secret put POLL_SECRET
wrangler deploy
```
Enter a long random secret when prompted. Save it securely; do not commit it.
Set the same value as a GitHub Actions repository secret named `POLL_SECRET`.
After deploy, copy the Worker URL.

## 5. Configure GitHub Actions
Repository → Settings → Secrets and variables → Actions → New repository secret
- `WORKER_URL`: Worker base URL, e.g. `https://your-worker.your-subdomain.workers.dev`
- `POLL_SECRET`: same secret configured on the Worker

The workflow runs every 10 minutes. GitHub scheduled runs are not guaranteed to start at the exact minute.

## 6. Riot integration
Do not enable real account linking until Riot approves RSO and VALORANT Production API access. At that stage, configure the approved OAuth client credentials as Worker secrets and implement the approved account/profile and match endpoints.

## Current status
- Static dashboard shell: included
- Worker health endpoint: included
- D1 schema: included
- Scheduled Actions runner: included
- Real RSO, PUUID retrieval, match polling, and Discord webhook delivery: intentionally not implemented until the required Riot access and product decisions are confirmed.
