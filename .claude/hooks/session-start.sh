#!/usr/bin/env bash
# SessionStart hook for Claude Code cloud sessions, synced from AI-Master-Instructions.
# Installs the pinned Node and npm (from .nvmrc and package.json "packageManager"), installs
# dependencies with the project's package manager, and points Playwright at the container's
# Chromium when its pinned build is missing. Then runs .claude/hooks/session-start.local.sh
# if the project has one. Local sessions (no CLAUDE_CODE_REMOTE) are left alone.
# A failed step is reported but never blocks the session.

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0

say() { echo "session-start: $*"; }
persist() { [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export $1" >> "$CLAUDE_ENV_FILE"; }

# 1. Pinned Node, only when .nvmrc asks for a version the container lacks.
if [ -f .nvmrc ] && command -v curl >/dev/null; then
  want="$(tr -d 'v[:space:]' < .nvmrc)"
  have="$(node -v 2>/dev/null | tr -d 'v')"
  case "$want" in
    *.*.*) ;;
    *) want="" ;; # only exact versions (x.y.z) are installed; ranges use the container's Node
  esac
  if [ -n "$want" ] && [ "$want" != "$have" ]; then
    dir="${HOME}/.cache/node/node-v${want}-linux-x64"
    if [ ! -x "${dir}/bin/node" ]; then
      mkdir -p "${HOME}/.cache/node"
      say "installing Node ${want}"
      curl -fsSL "https://nodejs.org/dist/v${want}/node-v${want}-linux-x64.tar.xz" \
        | tar -xJ -C "${HOME}/.cache/node" || say "Node ${want} download failed; using $(node -v)"
    fi
    if [ -x "${dir}/bin/node" ]; then
      export PATH="${dir}/bin:${PATH}"
      persist "PATH=\"${dir}/bin:\$PATH\""
    fi
  fi
fi

# 2. Dependencies, by lockfile.
if [ -f package.json ]; then
  pm="$(node -p "(require('./package.json').packageManager||'').split('@')[0]" 2>/dev/null)"
  if [ -f pnpm-lock.yaml ] || [ "$pm" = pnpm ]; then
    command -v pnpm >/dev/null || corepack enable >/dev/null 2>&1
    pnpm install --frozen-lockfile --silent >/dev/null 2>&1 || say "pnpm install failed"
  elif [ -f yarn.lock ] || [ "$pm" = yarn ]; then
    command -v yarn >/dev/null || corepack enable >/dev/null 2>&1
    yarn install --frozen-lockfile --silent >/dev/null 2>&1 || say "yarn install failed"
  else
    npm_want="$(node -p "const p=require('./package.json').packageManager||'';p.startsWith('npm@')?p.slice(4):''" 2>/dev/null)"
    if [ -n "$npm_want" ] && [ "$(npm -v 2>/dev/null)" != "$npm_want" ]; then
      npm install --global "npm@${npm_want}" --silent >/dev/null 2>&1 || say "npm ${npm_want} install failed"
    fi
    # npm install (not ci) reuses the container's cached node_modules.
    npm install --no-audit --no-fund --loglevel=error >/dev/null 2>&1 || say "npm install failed"
  fi
fi

# 3. Playwright: use the container's Chromium when the pinned build isn't installed.
browsers="${PLAYWRIGHT_BROWSERS_PATH:-}"
if [ -n "$browsers" ] && [ -d "$browsers" ] && [ -f node_modules/playwright-core/browsers.json ]; then
  rev="$(node -p "require('./node_modules/playwright-core/browsers.json').browsers.find(b => b.name === 'chromium').revision" 2>/dev/null)"
  if [ -n "$rev" ] && [ ! -d "${browsers}/chromium-${rev}" ]; then
    chrome="$(ls -d "${browsers}"/chromium-[0-9]*/chrome-linux*/chrome 2>/dev/null | sort -V | tail -n 1)"
    if [ -n "$chrome" ]; then
      persist "PLAYWRIGHT_CHROMIUM_PATH=\"${chrome}\""
      say "Playwright wants chromium-${rev}; PLAYWRIGHT_CHROMIUM_PATH=${chrome}"
    fi
  fi
fi

# 4. Project-specific steps.
if [ -f .claude/hooks/session-start.local.sh ]; then
  bash .claude/hooks/session-start.local.sh || say "session-start.local.sh failed"
fi

# 5. Work in flight elsewhere (GIT-06): cloud clones see only the default branch and its HANDOFF,
#    so list the other remote branches. dfma-review redid a slice that sat on one (2026-11-08).
if command -v git >/dev/null && git rev-parse --git-dir >/dev/null 2>&1; then
  here="$(git branch --show-current 2>/dev/null)"
  base="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')"
  tip="$(git rev-parse --verify --quiet "origin/${base:-main}" 2>/dev/null)"
  others=""; n=0
  while read -r sha ref; do
    b="${ref#refs/heads/}"
    case "$b" in "${base:-main}"|main|"$here"|"") continue ;; esac
    # Skip a branch already merged, when this clone has its commit; unknown commits are listed.
    if [ -n "$tip" ] && git cat-file -e "${sha}^{commit}" 2>/dev/null && git merge-base --is-ancestor "$sha" "$tip" 2>/dev/null; then continue; fi
    n=$((n + 1)); [ "$n" -le 8 ] && others="${others}${b} "
  done < <(timeout 10 git ls-remote --heads origin 2>/dev/null)
  [ "$n" -gt 8 ] && others="${others}(+$((n - 8)) more) "
  [ "$n" -gt 0 ] && say "unmerged branches on origin: ${others}- check them and their PRs for work in flight before starting (GIT-06)"
fi

# 6. HANDOFF over its cap (CTX-02, D-055): the same numbers sync --check prints as a note.
for h in docs/HANDOFF.md HANDOFF.md; do
  [ -f "$h" ] || continue
  lines="$(wc -l < "$h" | tr -d ' ')"; bytes="$(wc -c < "$h" | tr -d ' ')"
  if [ "$lines" -gt 60 ] || [ "$bytes" -gt 8192 ]; then
    say "${h} is ${lines} lines and ${bytes} bytes (cap 60 lines, 8192 bytes, CTX-02); move finished entries to docs/archive/ at the next checkpoint"
  fi
  break
done

[ -f package.json ] && say "ready: node $(node -v 2>/dev/null)"
exit 0
