# opencode-claude-auth-plus

[![CI](https://github.com/Kuass/opencode-claude-auth-plus/actions/workflows/ci.yml/badge.svg)](https://github.com/Kuass/opencode-claude-auth-plus/actions/workflows/ci.yml)

Self-contained Anthropic auth provider for OpenCode using your Claude Code credentials, with hot credential reload for tools like `claude-swap`.

This fork is currently intended to be used as a local OpenCode plugin from this repository. The `opencode-claude-auth-plus` npm package has not been published yet.

## Why this fork exists

`opencode-claude-auth-plus` is a `claude-swap`-focused custom build of [`opencode-claude-auth`](https://github.com/griffinmartin/opencode-claude-auth).

The upstream plugin discovers Claude Code credentials when OpenCode starts and keeps the selected account in memory. That works for normal OpenCode account selection, but it does not reliably notice an out-of-process credential change after [`claude-swap`](https://github.com/realiti4/claude-swap) switches the primary Claude Code account. In practice, OpenCode can keep using the old token until the process is restarted.

This plus build is customized for that workflow: after `cswap switch`, the next Anthropic request from the same running OpenCode session re-reads the active Claude credential source and uses the updated token.

## What's different from upstream

- Package identity is changed to `opencode-claude-auth-plus`, with a plus entrypoint while keeping compatibility exports for the original entrypoint names.
- Credential caching defaults to hot reload mode. `OPENCODE_CLAUDE_AUTH_CREDENTIAL_CACHE_TTL_MS` defaults to `0`, so the active credential source is checked on every request.
- macOS Keychain credentials are re-read before use, including the primary `Claude Code-credentials` entry that `claude-swap` updates. Upstream only refreshed the credentials file path in this pre-use reload path.
- The previous 30-second cache behavior can still be restored with `OPENCODE_CLAUDE_AUTH_CREDENTIAL_CACHE_TTL_MS=30000`.
- OpenCode data paths respect `XDG_DATA_HOME`, and Claude credential-file paths respect `CLAUDE_CONFIG_DIR`.
- Console warnings and docs use the `opencode-claude-auth-plus` name so local debugging clearly identifies the custom build.
- Regression tests cover default hot reload, configurable TTL caching, and Keychain-source reload behavior.

## Upstream PR notes

As of 2026-07-08, this fork has ported selected upstream PR behavior manually on top of the local `claude-swap` hot reload change:

| PR                                                                                                                                              | Status                             | Comment                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#99](https://github.com/griffinmartin/opencode-claude-auth/pull/99)                                                                            | Partial overlap, not cherry-picked | The plus change also updates the active in-memory credentials after re-reading storage. It does not include #99's suffixed-Keychain primary fallback or account detail labeling.                                                                                                                                                                                                        |
| [#132](https://github.com/griffinmartin/opencode-claude-auth/pull/132)                                                                          | Not applied                        | Automatic account failover after usage exhaustion can conflict with the explicit `claude-swap` workflow, where the user chooses the next account intentionally.                                                                                                                                                                                                                         |
| [#233](https://github.com/griffinmartin/opencode-claude-auth/pull/233) / [#239](https://github.com/griffinmartin/opencode-claude-auth/pull/239) | Applied manually                   | `XDG_DATA_HOME` is used for OpenCode auth/account-state paths on non-Windows, and `CLAUDE_CONFIG_DIR` is used for `.credentials.json`.                                                                                                                                                                                                                                                  |
| [#238](https://github.com/griffinmartin/opencode-claude-auth/pull/238)                                                                          | Not applied                        | Proactive background refresh is lower priority because this fork refreshes/reloads on the request path. It may still be useful later for long idle sessions.                                                                                                                                                                                                                            |
| [#240](https://github.com/griffinmartin/opencode-claude-auth/pull/240)                                                                          | Applied manually                   | Only the Claude CLI compatibility header update is ported: `ccVersion` bumped to `2.1.185` and three new base betas added (`thinking-token-count-2026-05-13`, `extended-cache-ttl-2025-04-11`, `effort-2025-11-24`). Header changes and native 1M context behavior are aligned with upstream; this fork never injects the legacy `context-1m` beta itself, with no plugin-level opt-in. |
| [#143](https://github.com/griffinmartin/opencode-claude-auth/pull/143)                                                                          | Applied manually                   | Thinking `budget_tokens` is now clamped to 80% of `max_tokens` whenever it meets or exceeds `max_tokens`, closing the API compatibility gap this PR flagged. Ported manually with tests since the upstream PR conflicted with this fork.                                                                                                                                                |
| [#198](https://github.com/griffinmartin/opencode-claude-auth/pull/198) / [#156](https://github.com/griffinmartin/opencode-claude-auth/pull/156) | Deferred                           | These change system prompt relocation policy. The behavior surface stays broad enough to keep them out of the `claude-swap` hot reload patch for now.                                                                                                                                                                                                                                   |

## How it works

The plugin registers its own auth provider with a custom fetch handler that intercepts all Anthropic API requests. It reads OAuth tokens from the macOS Keychain (or `~/.claude/.credentials.json` on other platforms), reloads the active credential source on every request by default, and handles the full request lifecycle — no builtin Anthropic auth plugin required. On macOS, multiple Claude Code accounts are detected automatically and can be switched via `opencode auth login`.

It also syncs credentials to OpenCode's `auth.json` as a fallback (on Windows, it writes to both `%USERPROFILE%\.local\share\opencode\auth.json` and `%LOCALAPPDATA%\opencode\auth.json` to cover all installation methods). If a token is near expiry, it refreshes directly via Anthropic's OAuth endpoint (zero LLM tokens consumed), falling back to the Claude CLI if the direct refresh fails. Background re-sync runs every 5 minutes.

## Prerequisites

- Claude Code installed and authenticated (run `claude` at least once)
- OpenCode installed

macOS is preferred (uses Keychain). Linux and Windows work via the credentials file fallback.

## Installation

**For Humans**

**Option A: Let an LLM do it**

Paste this into any LLM agent (Claude Code, OpenCode, Cursor, etc.):

```
Install the opencode-claude-auth-plus plugin from https://github.com/Kuass/opencode-claude-auth-plus as a local OpenCode plugin. Build the repo, create a local plugin shim under ~/.config/opencode/plugins/, and configure OpenCode to load ./plugins/opencode-claude-auth-plus.ts.
```

**Option B: Manual local setup**

1. **Clone and build this repo**:

   ```bash
   git clone https://github.com/Kuass/opencode-claude-auth-plus.git
   cd opencode-claude-auth-plus
   npx pnpm@10.32.1 install --frozen-lockfile
   npx pnpm@10.32.1 run build
   ```

2. **Create a local OpenCode plugin shim**:

   ```bash
   mkdir -p ~/.config/opencode/plugins

   cat > ~/.config/opencode/plugins/opencode-claude-auth-plus.ts <<'EOF'
   export {
     ClaudeAuthPlugin,
     default,
   } from "/absolute/path/to/opencode-claude-auth-plus/dist/index.js"
   EOF
   ```

   Replace `/absolute/path/to/opencode-claude-auth-plus` with the absolute path to this checkout.

3. **Add the local plugin** to `~/.config/opencode/opencode.json` or `~/.config/opencode/opencode.jsonc`:

   ```json
   {
     "plugin": ["./plugins/opencode-claude-auth-plus.ts"]
   }
   ```

   Remove `opencode-claude-auth` from the same plugin list if it is present. Loading both plugins can make the Anthropic auth provider ambiguous.

4. **Use it** — restart OpenCode once after changing the plugin list. The plugin handles auth automatically using your Claude Code credentials.

**For LLM Agents**

See [installation.md](installation.md) for step-by-step agent instructions.

**npm package**

After `opencode-claude-auth-plus` is published to npm, OpenCode can load it directly:

```json
{
  "plugin": ["opencode-claude-auth-plus@latest"]
}
```

## Usage

Just run OpenCode. The plugin handles auth automatically — it reads your Claude Code credentials, provides them to the Anthropic API, and refreshes them in the background. If your credentials aren't OAuth-based, the plugin falls through to standard API key auth.

## Supported models

15 supported models. Run `pnpm run test:models` to verify against your account.

| Model                      |
| -------------------------- |
| claude-haiku-4-5           |
| claude-haiku-4-5-20251001  |
| claude-opus-4-0            |
| claude-opus-4-1            |
| claude-opus-4-1-20250805   |
| claude-opus-4-20250514     |
| claude-opus-4-5            |
| claude-opus-4-5-20251101   |
| claude-opus-4-6            |
| claude-opus-4-7            |
| claude-sonnet-4-0          |
| claude-sonnet-4-20250514   |
| claude-sonnet-4-5          |
| claude-sonnet-4-5-20250929 |
| claude-sonnet-4-6          |

## Credential sources

The plugin checks these in order:

1. macOS Keychain (all `Claude Code-credentials*` entries — multiple accounts are detected automatically)
2. `~/.claude/.credentials.json` (fallback, works on all platforms; override the directory with `CLAUDE_CONFIG_DIR`)

## Multiple accounts (macOS)

If you have [multiple Claude Code accounts](https://gist.github.com/KMJ-007/0979814968722051620461ab2aa01bf2) authenticated on macOS, the plugin detects all of them from the Keychain automatically. Each account is labeled by its subscription tier (Claude Pro, Claude Max, etc.).

To switch accounts:

```bash
opencode auth login
```

Select "Switch Claude Code account" and pick the account you want to use. Your selection is persisted across sessions.

If only one account is found, the switcher is hidden and the plugin uses it directly.

## claude-swap hot reload

`opencode-claude-auth-plus` treats the active Claude credential store as mutable. On each cache miss it re-reads the selected source, including the macOS `Claude Code-credentials` Keychain item that `claude-swap` updates. The plus build defaults `OPENCODE_CLAUDE_AUTH_CREDENTIAL_CACHE_TTL_MS` to `0`, so the next OpenCode request after `cswap switch` uses the new token without restarting OpenCode.

For `claude-swap`-driven switching, keep the plugin's selected account on the primary `Claude Code-credentials` source. If you previously used `opencode auth login` to pin a suffixed Keychain entry, select the primary entry again or remove `~/.local/share/opencode/claude-account-source.txt`.

To restore upstream-style caching, set a non-zero TTL:

```bash
export OPENCODE_CLAUDE_AUTH_CREDENTIAL_CACHE_TTL_MS=30000
```

## Troubleshooting

| Problem                                             | Solution                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Credentials not found"                             | Run `claude` to authenticate with Claude Code first                                                                                                     |
| "Keychain is locked"                                | Run `security unlock-keychain ~/Library/Keychains/login.keychain-db`                                                                                    |
| "Token expired and refresh failed"                  | The plugin runs `claude` CLI to refresh automatically. If this fails, re-authenticate manually by running `claude`                                      |
| Not working on Linux/Windows                        | Ensure `~/.claude/.credentials.json` exists. Run `claude` to create it                                                                                  |
| Keychain access denied                              | Grant access when macOS prompts you                                                                                                                     |
| Keychain read timed out                             | Restart Keychain Access (can happen on macOS Tahoe)                                                                                                     |
| "Credentials are unavailable or expired"            | Run `claude` to refresh your Claude Code credentials                                                                                                    |
| "Extra usage is required for long context requests" | Your conversation exceeded 200k tokens, or your plan doesn't cover extended context usage. See [Long context (1M)](#long-context-1m) below              |
| Local plugin changes not picked up                  | Rebuild this repo with `npx pnpm@10.32.1 run build`, then restart OpenCode                                                                              |
| npm package not updating to latest version          | After npm publishing is enabled, delete the cached package: `rm -rf ~/.cache/opencode/packages/opencode-claude-auth-plus@latest/` then restart OpenCode |

### Diagnostic logging

If you're hitting auth errors that are hard to reproduce, enable debug logging to capture the full auth flow:

```bash
export CLAUDE_AUTH_DEBUG=1
```

Restart OpenCode and reproduce the issue. The plugin writes structured JSON logs to `~/.local/share/opencode/claude-auth-debug.log`. All secrets (tokens, API keys) are automatically redacted — the log file is safe to paste into a GitHub issue.

To write logs to a custom path:

```bash
export CLAUDE_AUTH_DEBUG=/tmp/claude-auth-debug.log
```

Disable when done:

```bash
unset CLAUDE_AUTH_DEBUG
```

## Long context (1M)

The legacy `context-1m-2025-08-07` beta header is never sent by this plugin — there's no config setting or environment variable to opt into it, and no plugin-level opt-in is needed. This aligns with upstream's native 1M context handling: whether a request gets extended context now depends entirely on your Claude plan and Anthropic's account-level settings, not on a beta flag this plugin injects.

Plan or billing restrictions can still produce "Extra usage is required for long context requests" errors independent of this plugin. If a custom beta flag you added via `ANTHROPIC_BETA_FLAGS` triggers a long context error, the plugin retries the request without the offending flag.

Versions before 0.8.0 sent the `context-1m-2025-08-07` beta automatically for 4.6+ models, which broke things for Pro users ([#64](https://github.com/griffinmartin/opencode-claude-auth/issues/64)). That default-on behavior stays gone — this build never injects the beta itself.

## Validating OAuth refresh

To verify the direct OAuth token refresh works with your credentials:

```bash
pnpm run validate:oauth           # refresh + write-back (safe, keeps credentials valid)
pnpm run validate:oauth -- --dry-run  # show what would be sent without making the request
```

This reads your stored credentials, calls Anthropic's OAuth token endpoint, and writes the new tokens back to storage. Refresh tokens rotate on each use, so write-back is enabled by default to keep your stored credentials valid.

## Environment variable overrides

All configurable parameters can be overridden via environment variables. If Anthropic changes something before we publish an update, set an env var and keep working:

| Variable                                       | Description                                                                                                                                                                                                                                                                                                                                                                                                    | Default                                                                                                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_CLI_VERSION`                        | Claude CLI version for user-agent and billing headers                                                                                                                                                                                                                                                                                                                                                          | `2.1.185`                                                                                                                                                                                                                                     |
| `ANTHROPIC_USER_AGENT`                         | Full User-Agent string (overrides CLI version)                                                                                                                                                                                                                                                                                                                                                                 | `claude-cli/{version} (external, cli)`                                                                                                                                                                                                        |
| `ANTHROPIC_BETA_FLAGS`                         | Comma-separated beta feature flags                                                                                                                                                                                                                                                                                                                                                                             | `claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,prompt-caching-scope-2026-01-05,context-management-2025-06-27,advisor-tool-2026-03-01,thinking-token-count-2026-05-13,extended-cache-ttl-2025-04-11,effort-2025-11-24` |
| `CLAUDE_AUTH_DEBUG`                            | Enable diagnostic logging (`1` for default path, or a custom file path)                                                                                                                                                                                                                                                                                                                                        | disabled                                                                                                                                                                                                                                      |
| `CLAUDE_CONFIG_DIR`                            | Directory containing `.credentials.json` for non-Keychain Claude Code credential fallback and write-back.                                                                                                                                                                                                                                                                                                      | `~/.claude`                                                                                                                                                                                                                                   |
| `OPENCODE_CLAUDE_AUTH_CREDENTIAL_CACHE_TTL_MS` | Credential cache TTL in milliseconds. `0` means re-read the active credential source on every request, which makes `claude-swap` switches effective on the next request.                                                                                                                                                                                                                                       | `0`                                                                                                                                                                                                                                           |
| `OPENCODE_CLAUDE_AUTH_MAX_RETRY_MS`            | Max ms the plugin waits when honouring a 529 `retry-after` header (and a 429 `retry-after` header if `OPENCODE_CLAUDE_AUTH_RETRY_429` is enabled). Beyond this cap the response surfaces immediately so OpenCode doesn't appear to hang on hour-long quota resets.                                                                                                                                             | `30000`                                                                                                                                                                                                                                       |
| `OPENCODE_CLAUDE_AUTH_RETRY_429`               | Whether the plugin retries HTTP 429 (rate limit) responses internally, capped by `OPENCODE_CLAUDE_AUTH_MAX_RETRY_MS`. Disabled by default, so 429s surface immediately as a mitigation that lets OpenCode/oh-my-openagent notice the failure sooner and consider falling back to another model. This is not a guarantee that fallback happens. Set to `true` to restore the old capped-retry behavior for 429. | `false` (unset)                                                                                                                                                                                                                               |
| `XDG_DATA_HOME`                                | OpenCode data root used for `auth.json` sync and `claude-account-source.txt` on non-Windows platforms.                                                                                                                                                                                                                                                                                                         | `~/.local/share`                                                                                                                                                                                                                              |

Example:

```bash
export ANTHROPIC_CLI_VERSION=2.2.0
export OPENCODE_CLAUDE_AUTH_CREDENTIAL_CACHE_TTL_MS=0
export OPENCODE_CLAUDE_AUTH_RETRY_429=true  # restore internal capped retries for 429 instead of surfacing immediately
```

## How it works (technical)

- Registers an `auth.loader` with a custom `fetch` that intercepts all Anthropic API requests
- Sets `Authorization: Bearer` with fresh OAuth tokens (reloaded on every request by default; configurable TTL)
- Translates tool names between OpenCode and Anthropic API formats (adds/strips `mcp_` prefix)
- Buffers SSE response streams at event boundaries for reliable tool name translation
- Injects Claude Code identity into system prompts via `experimental.chat.system.transform`
- Sets required API headers (beta flags, billing, user-agent) with model-aware selection
- On macOS, enumerates all `Claude Code-credentials*` Keychain entries and labels them by subscription tier
- Provides an account switcher via `opencode auth login` when multiple accounts are found; persists selection to `~/.local/share/opencode/claude-account-source.txt` or `$XDG_DATA_HOME/opencode/claude-account-source.txt` on non-Windows platforms
- Syncs credentials to `auth.json` on startup and every 5 minutes as a fallback (sync never triggers refresh; refresh is lazy, only on API requests)
- On Windows, writes to both `%USERPROFILE%\.local\share\opencode\auth.json` and `%LOCALAPPDATA%\opencode\auth.json`
- Surfaces HTTP 429 (rate limit) responses immediately by default, unless `OPENCODE_CLAUDE_AUTH_RETRY_429=true`; this lets OpenCode/oh-my-openagent observe the 429 sooner and consider falling back to another model, though it's a mitigation, not a guarantee that fallback happens. Retries 529 (overloaded) with exponential backoff, respecting `retry-after` headers up to `OPENCODE_CLAUDE_AUTH_MAX_RETRY_MS`
- When a token is within 60 seconds of expiry, refreshes directly via `POST https://claude.ai/v1/oauth/token` (no LLM tokens consumed). Falls back to `claude` CLI if the direct refresh fails. New tokens are written back to Keychain (macOS) or credentials file (Linux/Windows) to keep stored credentials in sync with rotated refresh tokens
- If credentials aren't OAuth-based, the auth loader returns `{}` and falls through to API key auth
- If credentials are unavailable or unreadable, the plugin disables itself and OpenCode continues without Claude auth

## Disclaimer

This plugin uses Claude Code's OAuth credentials to authenticate with Anthropic's API. Anthropic's Terms of Service state that Claude Pro/Max subscription tokens should only be used with official Anthropic clients. This plugin exists as a community workaround and may stop working if Anthropic changes their OAuth infrastructure. Use at your own discretion.

## License

MIT
