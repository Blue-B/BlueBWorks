#!/usr/bin/env bash
# Run this on the Oracle Ubuntu account once, not from ChatGPT.
set -euo pipefail
ROOT="/home/ubuntu/projects/BlueBWorks"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
if [[ ! -f "$ROOT/ops/oracle/publisher.mjs" ]]; then
  echo "Publisher files not found at $ROOT" >&2
  exit 1
fi
if ! command -v node >/dev/null || ! command -v git >/dev/null || ! command -v npm >/dev/null; then
  echo "node, npm and git are required" >&2
  exit 1
fi
echo "Checking a fresh clone, build and non-writing Git push dry-run..."
node "$ROOT/ops/oracle/publisher.mjs" --probe
mkdir -p "$UNIT_DIR"
ln -sfn "$ROOT/ops/oracle/bluebworks-publisher.service" "$UNIT_DIR/bluebworks-publisher.service"
ln -sfn "$ROOT/ops/oracle/bluebworks-publisher.timer" "$UNIT_DIR/bluebworks-publisher.timer"
systemctl --user daemon-reload
systemctl --user enable --now bluebworks-publisher.timer
systemctl --user list-timers bluebworks-publisher.timer
if command -v loginctl >/dev/null; then
  LINGER="$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || echo unknown)"
  if [[ "$LINGER" != yes ]]; then
    echo "Warning: user linger is $LINGER. To keep the timer running after logout, an administrator may need: sudo loginctl enable-linger $USER"
  fi
fi
echo "Timer installed. Articles must be submitted to pending/articles/ on GitHub main."
