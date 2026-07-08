# opencode-claude-auth-plus

[![npm](https://img.shields.io/npm/v/opencode-claude-auth-plus)](https://www.npmjs.com/package/opencode-claude-auth-plus)
[![CI](https://github.com/griffinmartin/opencode-claude-auth/actions/workflows/ci.yml/badge.svg)](https://github.com/griffinmartin/opencode-claude-auth/actions/workflows/ci.yml)
[![Socket Badge](https://socket.dev/api/badge/npm/package/opencode-claude-auth-plus)](https://socket.dev/npm/package/opencode-claude-auth-plus)

Self-contained Anthropic auth provider for OpenCode using your Claude Code credentials, with hot credential reload for tools like `claude-swap`.

## Why this fork exists

`opencode-claude-auth-plus` is a `claude-swap`-focused custom build of [`opencode-claude-auth`](https://github.com/griffinmartin/opencode-claude-auth).

The upstream plugin discovers Claude Code credentials when OpenCode starts and keeps the selected account in memory. That works for normal OpenCode account selection, but it does not reliably notice an out-of-process credential change after [`claude-swap`](https://github.com/realiti4/claude-swap) switches the primary Claude Code account. In practice, OpenCode can keep using the old token until the process is restarted.

This plus build is customized for that workflow: after `cswap switch`, the next Anthropic request from the same running OpenCode session re-reads the active Claude credential source and uses the updated token.

## What's different from upstream

- Package identity is changed to `opencode-claude-auth-plus`, with a plus entrypoint while keeping compatibility exports for the original entrypoint names.
- Credential caching defaults to hot reload mode. `OPENCODE_CLAUDE_AUTH_CREDENTIAL_CACHE_TTL_MS` defaults to `0`, so the active credential source is checked on every request.
- macOS Keychain credentials are re-read before use, including the primary `Claude Code-credentials` entry that `claude-swap` updates. Upstream only refreshed the credentials file path in this pre-use reload path.
- The previous 30-second cache behavior can still be restored with `OPENCODE_CLAUDE_AUTH_CREDENTIAL_CACHE_TTL_MS=30000`.
- Console warnings and docs use the `opencode-claude-auth-plus` name so local debugging clearly identifies the custom build.
- Regression tests cover default hot reload, configurable TTL caching, and Keychain-source reload behavior.

## Upstream PR notes

As of 2026-07-08, this fork has not cherry-picked any open upstream PRs. The `claude-swap` hot reload behavior is a local plus change. These upstream PRs were reviewed while shaping the fork:

| PR                                                                                                                                              | Status                             | Comment                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#99](https://github.com/griffinmartin/opencode-claude-auth/pull/99)                                                                            | Partial overlap, not cherry-picked | The plus change also updates the active in-memory credentials after re-reading storage. It does not include #99's suffixed-Keychain primary fallback or account detail labeling. |
| [#132](https://github.com/griffinmartin/opencode-claude-auth/pull/132)                                                                          | Not applied                        | Automatic account failover after usage exhaustion can conflict with the explicit `claude-swap` workflow, where the user chooses the next account intentionally.                  |
| [#233](https://github.com/griffinmartin/opencode-claude-auth/pull/233) / [#239](https://github.com/griffinmartin/opencode-claude-auth/pull/239) | Good next candidates               | `XDG_DATA_HOME` and `CLAUDE_CONFIG_DIR` support are small, useful path fixes. They should be ported deliberately instead of importing the larger path-resolution PR wholesale.   |
| [#238](https://github.com/griffinmartin/opencode-claude-auth/pull/238)                                                                          | Not applied                        | Proactive background refresh is lower priority because this fork refreshes/reloads on the request path. It may still be useful later for long idle sessions.                     |
| [#143](https://github.com/griffinmartin/opencode-claude-auth/pull/143)                                                                          | Candidate                          | Capping invalid `thinking.budget_tokens` is a small defensive API compatibility fix, but the upstream PR currently conflicts and should be ported manually with tests.           |
| [#198](https://github.com/griffinmartin/opencode-claude-auth/pull/198) / [#156](https://github.com/griffinmartin/opencode-claude-auth/pull/156) | Deferred                           | These change system prompt relocation policy. They are potentially valuable, but the behavior surface is broad enough to keep them out of the `claude-swap` hot reload patch.    |

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
Install the opencode-claude-auth-plus plugin and configure it by following the installation.md in this repo.
```

**Option B: Manual setup**

1. **Add the plugin** to `~/.config/opencode/opencode.json`:

   ```json
   {
     "plugin": ["opencode-claude-auth-plus@latest"]
   }
   ```

   > The `@latest` tag ensures OpenCode always pulls the newest version on startup. No manual `npm install` is needed — OpenCode [automatically installs npm plugins using Bun at startup](https://opencode.ai/docs/plugins/#how-plugins-are-installed).

2. **Use it** — just run OpenCode. The plugin handles auth automatically using your Claude Code credentials.

**For LLM Agents**

See [installation.md](installation.md) for step-by-step agent instructions.

**Local development**

Before publishing `opencode-claude-auth-plus` to npm, you can build this repo and expose the compiled plugin through an OpenCode local plugin file under `~/.config/opencode/plugins/` or `.opencode/plugins/`.

```js
export {
  ClaudeAuthPlugin,
  default,
} from "/absolute/path/to/opencode-claude-auth-plus/dist/index.js"
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
2. `~/.claude/.credentials.json` (fallback, works on all platforms)

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

| Problem                                             | Solution                                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| "Credentials not found"                             | Run `claude` to authenticate with Claude Code first                                                                    |
| "Keychain is locked"                                | Run `security unlock-keychain ~/Library/Keychains/login.keychain-db`                                                   |
| "Token expired and refresh failed"                  | The plugin runs `claude` CLI to refresh automatically. If this fails, re-authenticate manually by running `claude`     |
| Not working on Linux/Windows                        | Ensure `~/.claude/.credentials.json` exists. Run `claude` to create it                                                 |
| Keychain access denied                              | Grant access when macOS prompts you                                                                                    |
| Keychain read timed out                             | Restart Keychain Access (can happen on macOS Tahoe)                                                                    |
| "Credentials are unavailable or expired"            | Run `claude` to refresh your Claude Code credentials                                                                   |
| "Extra usage is required for long context requests" | Your conversation exceeded 200k tokens. See [Long context (1M)](#long-context-1m) below                                |
| Plugin not updating to latest version               | Delete the cached package: `rm -rf ~/.cache/opencode/packages/opencode-claude-auth-plus@latest/` then restart OpenCode |

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

The `context-1m-2025-08-07` beta header is not sent by default. Without it, the API caps context at 200k tokens.

To enable 1M context (requires Claude Max or a plan with extra usage coverage), use **either** of these methods:

**Option A: Config file** (recommended — no environment setup needed)

Add `enable1mContext` to any agent in your `opencode.json` (project-level or `~/.config/opencode/opencode.json`). Setting it in any one agent enables 1M context globally for all supported models — you don't need to set it for each agent:

```json
{
  "plugin": ["opencode-claude-auth-plus@latest"],
  "agent": {
    "build": {
      "enable1mContext": true
    }
  }
}
```

**Option B: Environment variable**

```bash
export ANTHROPIC_ENABLE_1M_CONTEXT=true
```

If both are set, the environment variable takes priority.

The Claude CLI itself treats 1M context as opt-in (via a `[1m]` model suffix). Sending the beta without a plan that covers long context charges causes "Extra usage is required for long context requests" errors. Versions before 0.8.0 sent this beta automatically for 4.6+ models, which broke things for Pro users ([#64](https://github.com/griffinmartin/opencode-claude-auth/issues/64)).

If a long context error still occurs (e.g. from a beta flag added via `ANTHROPIC_BETA_FLAGS`), the plugin retries without the offending flag.

## Validating OAuth refresh

To verify the direct OAuth token refresh works with your credentials:

```bash
pnpm run validate:oauth           # refresh + write-back (safe, keeps credentials valid)
pnpm run validate:oauth -- --dry-run  # show what would be sent without making the request
```

This reads your stored credentials, calls Anthropic's OAuth token endpoint, and writes the new tokens back to storage. Refresh tokens rotate on each use, so write-back is enabled by default to keep your stored credentials valid.

## Environment variable overrides

All configurable parameters can be overridden via environment variables. If Anthropic changes something before we publish an update, set an env var and keep working:

| Variable                                       | Description                                                                                                                                                                            | Default                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_CLI_VERSION`                        | Claude CLI version for user-agent and billing headers                                                                                                                                  | `2.1.80`                                                                                                |
| `ANTHROPIC_USER_AGENT`                         | Full User-Agent string (overrides CLI version)                                                                                                                                         | `claude-cli/{version} (external, cli)`                                                                  |
| `ANTHROPIC_BETA_FLAGS`                         | Comma-separated beta feature flags                                                                                                                                                     | `claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,prompt-caching-scope-2026-01-05` |
| `ANTHROPIC_ENABLE_1M_CONTEXT`                  | Enable 1M token context window for 4.6+ models (requires Max subscription)                                                                                                             | `false`                                                                                                 |
| `CLAUDE_AUTH_DEBUG`                            | Enable diagnostic logging (`1` for default path, or a custom file path)                                                                                                                | disabled                                                                                                |
| `OPENCODE_CLAUDE_AUTH_CREDENTIAL_CACHE_TTL_MS` | Credential cache TTL in milliseconds. `0` means re-read the active credential source on every request, which makes `claude-swap` switches effective on the next request.               | `0`                                                                                                     |
| `OPENCODE_CLAUDE_AUTH_MAX_RETRY_MS`            | Max ms the plugin waits when honouring a 429/529 `retry-after` header. Beyond this cap the response surfaces immediately so OpenCode doesn't appear to hang on hour-long quota resets. | `30000`                                                                                                 |

Example:

```bash
export ANTHROPIC_CLI_VERSION=2.2.0
export ANTHROPIC_ENABLE_1M_CONTEXT=true  # requires Claude Max
export OPENCODE_CLAUDE_AUTH_CREDENTIAL_CACHE_TTL_MS=0
```

## How it works (technical)

- Registers an `auth.loader` with a custom `fetch` that intercepts all Anthropic API requests
- Sets `Authorization: Bearer` with fresh OAuth tokens (reloaded on every request by default; configurable TTL)
- Translates tool names between OpenCode and Anthropic API formats (adds/strips `mcp_` prefix)
- Buffers SSE response streams at event boundaries for reliable tool name translation
- Injects Claude Code identity into system prompts via `experimental.chat.system.transform`
- Sets required API headers (beta flags, billing, user-agent) with model-aware selection
- On macOS, enumerates all `Claude Code-credentials*` Keychain entries and labels them by subscription tier
- Provides an account switcher via `opencode auth login` when multiple accounts are found; persists selection to `~/.local/share/opencode/claude-account-source.txt`
- Syncs credentials to `auth.json` on startup and every 5 minutes as a fallback (sync never triggers refresh; refresh is lazy, only on API requests)
- On Windows, writes to both `%USERPROFILE%\.local\share\opencode\auth.json` and `%LOCALAPPDATA%\opencode\auth.json`
- Retries API requests on 429 (rate limit) and 529 (overloaded) with exponential backoff, respecting `retry-after` headers
- When a token is within 60 seconds of expiry, refreshes directly via `POST https://claude.ai/v1/oauth/token` (no LLM tokens consumed). Falls back to `claude` CLI if the direct refresh fails. New tokens are written back to Keychain (macOS) or credentials file (Linux/Windows) to keep stored credentials in sync with rotated refresh tokens
- If credentials aren't OAuth-based, the auth loader returns `{}` and falls through to API key auth
- If credentials are unavailable or unreadable, the plugin disables itself and OpenCode continues without Claude auth

## Disclaimer

This plugin uses Claude Code's OAuth credentials to authenticate with Anthropic's API. Anthropic's Terms of Service state that Claude Pro/Max subscription tokens should only be used with official Anthropic clients. This plugin exists as a community workaround and may stop working if Anthropic changes their OAuth infrastructure. Use at your own discretion.

## License

MIT
