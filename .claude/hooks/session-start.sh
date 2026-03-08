#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "Setting up pygame-web.github.io development environment..."

# Install markdownlint-cli for linting markdown files
npm install -g markdownlint-cli

echo "Setup complete."
