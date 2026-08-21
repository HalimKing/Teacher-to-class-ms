# Deploy to the VPS from GitHub Actions

Pushes to `main` run tests, then GitHub Actions SSHs into the VPS and triggers a deploy
there. Render stays optional: it deploys only if `RENDER_DEPLOY_HOOK_URL` is set.

The app runs in Docker Compose on the VPS (`web`, `worker`, `scheduler`, `postgres`).
GitHub Actions never touches files directly — it only opens an SSH connection with a key
that is restricted (via a forced `command=` in `authorized_keys`) to run one script on the
server: `deploy.sh`, sitting next to `docker-compose.yml` outside the git-tracked `repo/`
directory. Whatever command the workflow "requests" over SSH is ignored; the forced
command always runs instead. That script:

1. `git fetch origin main && git reset --hard origin/main` inside `repo/`
2. `docker compose build web worker scheduler`
3. `docker compose up -d --force-recreate web worker scheduler`
4. Waits for all three to report `healthy`, or exits non-zero after ~60s

`postgres` is never rebuilt or recreated by this flow, so data is untouched by every
deploy. Composer/npm install, asset builds, and `php artisan migrate --force` all happen
inside the Docker build/entrypoint — nothing needs to be installed on the VPS itself beyond
Docker and git.

## One-time server setup (already done for this app)

1. A dedicated ed25519 keypair was generated on the VPS for this purpose only (not shared
   with other apps on the box).
2. Its public key was added to the deploy user's `~/.ssh/authorized_keys`, restricted to:
   ```
   restrict,command="/home/eben/apps/teacher-to-class-ms/deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... github-actions-deploy-ttcms
   ```
   Even if the private key ever leaked, it can only ever run that one script — no shell,
   no port/agent forwarding, no other command.
3. The private key was uploaded to the GitHub repo as `VPS_SSH_PRIVATE_KEY` and then
   deleted from the VPS's own disk (it only needs to exist as a GitHub secret).

## GitHub secrets in use

| Secret | Required | Notes |
|--------|----------|-------|
| `VPS_HOST` | yes | VPS public IP/hostname |
| `VPS_USERNAME` | yes | SSH user on the VPS |
| `VPS_SSH_PRIVATE_KEY` | yes | Private half of the restricted deploy key |
| `VPS_SSH_KNOWN_HOSTS` | no | Output of `ssh-keyscan -p 22 <host>`; if absent, CI keyscans at deploy time |
| `VPS_PORT` | no | Defaults to `22` |

Optional Render secrets are listed below. If they are absent, the Render job is skipped.

## Manual deploy

Actions tab → **tests** → **Run workflow** (branch `main`). Or SSH in with any key/account
and run `~/apps/teacher-to-class-ms/deploy.sh` directly.

## Render (optional, not currently used)

`deploy-render` triggers Render deploy hooks (`RENDER_DEPLOY_HOOK_URL`,
`RENDER_WORKER_DEPLOY_HOOK_URL`, `RENDER_SCHEDULER_DEPLOY_HOOK_URL`) if set. It's
independent of the VPS deploy above and safe to leave unset.
