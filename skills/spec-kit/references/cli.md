# specify CLI Reference

Version: 0.1.6 | Template: 0.1.7 | Requires: Python 3.11+, uv, Git

## specify init

Bootstrap a new project with spec-kit templates and slash commands.

```bash
# Typical usage
specify init my-project --ai claude
specify init . --ai claude                    # current directory
specify init --here --ai claude               # current directory (alt)
specify init --here --ai claude --ai-skills   # + install as agent skills
specify init --here --force                   # skip confirmation if dir not empty
```

### --ai \<agent\> options

| Value | Description |
|-------|-------------|
| `claude` | Claude Code (creates `.claude/commands/`) |
| `gemini` | Gemini CLI |
| `copilot` | GitHub Copilot (`.github/copilot-instructions.md`) |
| `cursor-agent` | Cursor agent mode |
| `codex` | OpenAI Codex CLI |
| `windsurf` | Windsurf IDE |
| `qwen` | Qwen Code |
| `opencode` | opencode |
| `amp` | Amp |
| `kilocode` | Kilo Code |
| `auggie` | Auggie CLI |
| `codebuddy` | CodeBuddy CLI |
| `shai` | SHAI |
| `q` | Amazon Q Developer CLI |
| `agy` | Antigravity |
| `bob` | IBM Bob |
| `qodercli` | Qoder CLI |
| `roo` | Roo Code (IDE) |
| `generic` | Any agent — requires `--ai-commands-dir` |

### All flags

| Flag | Purpose |
|------|---------|
| `--ai <agent>` | Target AI agent |
| `--here` | Init in current directory (same as passing `.`) |
| `--force` | Skip confirmation for non-empty directory |
| `--no-git` | Skip git repository initialization |
| `--ai-skills` | Install Prompt.MD templates as agent skills (requires `--ai`) |
| `--ai-commands-dir <path>` | Custom command output dir (required with `--ai generic`) |
| `--script sh\|ps` | Script variant: bash/zsh (`sh`) or PowerShell (`ps`) |
| `--github-token <token>` | GitHub token (or set `GH_TOKEN` / `GITHUB_TOKEN` env var) |
| `--skip-tls` | Skip SSL/TLS verification (not recommended) |
| `--ignore-agent-tools` | Skip checks for AI agent tools |
| `--debug` | Verbose diagnostic output |

---

## specify check

Check which AI agent tools are installed on the current machine.

```bash
specify check
```

---

## specify version

Show version and system info.

```bash
specify version
```

---

## specify extension

Manage spec-kit extensions (community/third-party add-ons).

```bash
specify extension list                    # list installed extensions
specify extension search <query>          # search catalog
specify extension info <name>             # show extension details
specify extension add <name>              # install extension
specify extension remove <name>           # uninstall extension
specify extension update [name]           # update one or all extensions
specify extension enable <name>           # enable a disabled extension
specify extension disable <name>          # disable without removing
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GH_TOKEN` / `GITHUB_TOKEN` | GitHub token for API requests during init |
| `SPECIFY_FEATURE` | Override feature detection for non-Git repos. Set to the feature directory name (e.g., `001-photo-albums`). **Must be set before `/speckit.plan` or any follow-up commands.** |

---

## Installation & Upgrade

```bash
# Persistent install (recommended)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Upgrade to latest version
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git

# One-time use without installing
uvx --from git+https://github.com/github/spec-kit.git specify init <PROJECT_NAME>
```
