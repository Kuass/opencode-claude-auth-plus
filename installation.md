# Install opencode-claude-auth-plus

These instructions are designed for AI coding agents.

## Prerequisites

Before installing, verify you have OpenCode and Claude Code installed and authenticated.

### Check OpenCode version

```bash
opencode --version
```

You should see a version number (e.g., `1.2.28`).

### Check Claude Code credentials (macOS)

```bash
security find-generic-password -s "Claude Code-credentials" -w
```

If this returns credentials, you're authenticated. If it fails or returns nothing, try the fallback:

### Check Claude Code credentials (fallback for all platforms)

```bash
cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.credentials.json"
```

If this file exists and contains valid JSON, you're authenticated.

### If credentials don't exist

Run Claude Code to authenticate:

```bash
claude
```

This will prompt you to log in and store credentials in Keychain (macOS) or `~/.claude/.credentials.json` (other platforms). If you set `CLAUDE_CONFIG_DIR`, the plugin reads `.credentials.json` from that directory instead.

## Installation

### Step 1: Build the plugin

Run these commands from this repository checkout:

```bash
npx pnpm@10.32.1 install --frozen-lockfile
npx pnpm@10.32.1 run build
```

### Step 2: Create a local OpenCode plugin shim

Create `~/.config/opencode/plugins/opencode-claude-auth-plus.ts` with an absolute import path to this checkout's compiled plugin:

```bash
mkdir -p ~/.config/opencode/plugins

cat > ~/.config/opencode/plugins/opencode-claude-auth-plus.ts <<'EOF'
export {
  ClaudeAuthPlugin,
  default,
} from "/absolute/path/to/opencode-claude-auth-plus/dist/index.js"
EOF
```

Replace `/absolute/path/to/opencode-claude-auth-plus` with this repository's absolute path.

### Step 3: Add to OpenCode configuration

Edit `~/.config/opencode/opencode.json` or `~/.config/opencode/opencode.jsonc`.

Add the local plugin to the `plugin` array:

```json
{
  "plugin": ["./plugins/opencode-claude-auth-plus.ts"]
}
```

Remove `opencode-claude-auth` from the same plugin list if it is present. Loading both plugins can make the Anthropic auth provider ambiguous.

### Step 4: Verification

Verify the plugin was added:

```bash
cat ~/.config/opencode/opencode.json 2>/dev/null || cat ~/.config/opencode/opencode.jsonc
```

You should see `./plugins/opencode-claude-auth-plus.ts` in the `plugin` array.

## Upgrading

When this repo changes, rebuild the local plugin and restart OpenCode:

```bash
npx pnpm@10.32.1 run build
```

## Done

The plugin is now installed and configured. When you run OpenCode, it will automatically use your Claude Code credentials — no separate login needed.

## Troubleshooting

If you encounter issues, see the [main README troubleshooting section](README.md#troubleshooting).
