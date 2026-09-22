#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_PID="$$"

cleanup() {
  echo ""
  echo "==> Stopping..."
  if command -v taskkill >/dev/null 2>&1 && command -v netstat >/dev/null 2>&1; then
    for port in 3000 3001; do
      pids="$(netstat -ano -p TCP 2>/dev/null | awk -v p=":$port" '$1 == "TCP" && $2 ~ p"$" && $4 == "LISTENING" { print $NF }' | sort -u)"
      for pid in $pids; do
        taskkill //F //T //PID "$pid" >/dev/null 2>&1 || true
      done
    done
  fi
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

server() {
  (
    cd "$ROOT/$1" || exit 1
    npm run dev &
    npm_pid=$!
    while kill -0 "$MAIN_PID" 2>/dev/null; do
      sleep 1
    done
    if command -v taskkill >/dev/null 2>&1; then
      taskkill //F //T //PID "$npm_pid" >/dev/null 2>&1 || true
    else
      kill "$npm_pid" 2>/dev/null || true
    fi
  ) &
}

echo "==> Starting backend (http://localhost:3001)..."
server backend
BACK_PID=$!

echo "==> Starting frontend (http://localhost:3000)..."
server frontend
FRONT_PID=$!

echo "==> Press Ctrl+C to stop both."

wait