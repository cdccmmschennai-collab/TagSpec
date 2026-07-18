#!/usr/bin/env bash
#
# dev.sh — one-command local development for TagSpec.
#
# Starts (and stops) the three services that make up the app:
#   1. database  -> PostgreSQL 16 in Docker (docker-compose.yml, port 5544)
#   2. backend   -> FastAPI + uvicorn with hot-reload            (port 8000)
#   3. frontend  -> React + Vite dev server with hot-reload      (port 5173)
#
# The database keeps running under Docker (it has restart: unless-stopped).
# The backend and frontend run directly on your machine so code edits reload
# instantly. PIDs and logs are written to .runtime/ so we can stop them later.
#
# Usage:
#   ./dev.sh up        start everything
#   ./dev.sh down      stop backend + frontend (database keeps running)
#   ./dev.sh stop-all  stop backend + frontend AND the database container
#   ./dev.sh restart   down + up
#   ./dev.sh status    show what is currently running
#   ./dev.sh logs      follow backend + frontend logs (Ctrl-C to stop watching)

set -euo pipefail

# --- Resolve paths relative to this script, so it works from any directory ---
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME="$ROOT/.runtime"
mkdir -p "$RUNTIME"

BACKEND_PID="$RUNTIME/backend.pid"
FRONTEND_PID="$RUNTIME/frontend.pid"
BACKEND_LOG="$RUNTIME/backend.log"
FRONTEND_LOG="$RUNTIME/frontend.log"

DB_CONTAINER="eai_database"   # container_name from docker-compose.yml

# --- Small helpers for readable, colored output --------------------------------
c_green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
c_yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
c_red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }
c_blue()   { printf '\033[0;34m%s\033[0m\n' "$*"; }

# Is a TCP port already being listened on? (guards against stale strays.)
port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# Is the process recorded in $1 (a pid file) still alive?
is_running() {
  local pidfile="$1"
  [[ -f "$pidfile" ]] || return 1
  local pid
  pid="$(cat "$pidfile" 2>/dev/null || true)"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# Launch a background service in its OWN process group, so that when we stop it
# we can kill the whole tree (uvicorn --reload and vite each spawn children).
# $1 = pid file, $2 = log file, $3 = human name, $4 = shell command to run.
start_service() {
  local pidfile="$1" logfile="$2" name="$3" cmd="$4"
  if is_running "$pidfile"; then
    c_yellow "  $name already running (pid $(cat "$pidfile"))"
    return 0
  fi
  # perl setpgrp puts the process in a fresh process group whose id == its pid,
  # so later `kill -- -PID` reaches every child. Then bash exec-chains into the
  # real command, keeping that same pid the whole way down.
  perl -e 'setpgrp(0,0); exec @ARGV or die $!;' \
    bash -c "$cmd" >>"$logfile" 2>&1 &
  echo $! >"$pidfile"
  c_green "  $name started (pid $(cat "$pidfile"))  -> log: ${logfile#"$ROOT"/}"
}

# Stop the process group recorded in pid file $1 (name $2).
stop_service() {
  local pidfile="$1" name="$2"
  if ! is_running "$pidfile"; then
    c_yellow "  $name not running"
    rm -f "$pidfile"
    return 0
  fi
  local pid; pid="$(cat "$pidfile")"
  # Negative pid = "kill the whole process group".
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  # Give it a moment, then force if still alive.
  for _ in 1 2 3 4 5; do is_running "$pidfile" || break; sleep 0.5; done
  if is_running "$pidfile"; then
    kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  fi
  rm -f "$pidfile"
  c_green "  $name stopped"
}

# --- Wait until the Postgres container reports healthy -------------------------
wait_for_db() {
  printf '  waiting for database to be healthy'
  for _ in $(seq 1 30); do
    local status
    status="$(docker inspect --format '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo missing)"
    if [[ "$status" == "healthy" ]]; then
      printf '\n'; c_green "  database healthy"; return 0
    fi
    printf '.'; sleep 1
  done
  printf '\n'; c_red "  database did not become healthy in time — check: docker compose logs database"
  return 1
}

# --- Commands ------------------------------------------------------------------
cmd_up() {
  c_blue "==> Starting database (Docker)"
  ( cd "$ROOT" && docker compose up -d database >/dev/null )
  wait_for_db

  c_blue "==> Applying database migrations (alembic upgrade head)"
  ( cd "$ROOT/backend" && ./.venv/bin/alembic upgrade head ) \
    && c_green "  migrations up to date" \
    || c_red   "  migrations failed — check output above"

  c_blue "==> Starting backend (FastAPI @ http://localhost:8000)"
  if ! is_running "$BACKEND_PID" && port_in_use 8000; then
    c_red "  port 8000 is already in use by another process (a stale server?)."
    c_red "  Find it with:  lsof -nP -iTCP:8000 -sTCP:LISTEN     then stop it and re-run ./dev.sh up"
  else
    start_service "$BACKEND_PID" "$BACKEND_LOG" "backend" \
      "cd '$ROOT/backend' && exec ./.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
  fi

  c_blue "==> Starting frontend (Vite @ http://localhost:5173)"
  if ! is_running "$FRONTEND_PID" && port_in_use 5173; then
    c_red "  port 5173 is already in use by another process (a stale server?)."
    c_red "  Find it with:  lsof -nP -iTCP:5173 -sTCP:LISTEN     then stop it and re-run ./dev.sh up"
  else
    start_service "$FRONTEND_PID" "$FRONTEND_LOG" "frontend" \
      "cd '$ROOT/frontend' && exec npm run dev"
  fi

  echo
  c_green "All set. Open:"
  echo "  Frontend : http://localhost:5173"
  echo "  API docs : http://localhost:8000/docs"
  echo
  echo "  Follow logs with: ./dev.sh logs      Stop with: ./dev.sh down"
}

cmd_down() {
  c_blue "==> Stopping backend + frontend"
  stop_service "$BACKEND_PID" "backend"
  stop_service "$FRONTEND_PID" "frontend"
  c_yellow "  (database left running — stop it with ./dev.sh stop-all)"
}

cmd_stop_all() {
  cmd_down
  c_blue "==> Stopping database (Docker)"
  ( cd "$ROOT" && docker compose stop database >/dev/null ) && c_green "  database stopped"
}

cmd_status() {
  c_blue "==> Status"
  is_running "$BACKEND_PID"  && c_green "  backend  running (pid $(cat "$BACKEND_PID"))"  || c_yellow "  backend  stopped"
  is_running "$FRONTEND_PID" && c_green "  frontend running (pid $(cat "$FRONTEND_PID"))" || c_yellow "  frontend stopped"
  local db; db="$(docker inspect --format '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo 'not created')"
  [[ "$db" == "healthy" ]] && c_green "  database $db" || c_yellow "  database $db"
}

cmd_logs() {
  c_blue "==> Following logs (Ctrl-C to stop watching; services keep running)"
  touch "$BACKEND_LOG" "$FRONTEND_LOG"
  tail -n 20 -f "$BACKEND_LOG" "$FRONTEND_LOG"
}

case "${1:-}" in
  up)        cmd_up ;;
  down)      cmd_down ;;
  stop-all)  cmd_stop_all ;;
  restart)   cmd_down; echo; cmd_up ;;
  status)    cmd_status ;;
  logs)      cmd_logs ;;
  *)
    echo "Usage: ./dev.sh {up|down|stop-all|restart|status|logs}"
    exit 1
    ;;
esac
