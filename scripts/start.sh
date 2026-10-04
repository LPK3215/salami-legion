#!/usr/bin/env bash
# 蚕食军团 —— 幂等启动脚本
# 用法: bash scripts/start.sh   （PORT 环境变量可选，默认 8080）
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"
LOG="$ROOT/.server.log"
PIDFILE="$ROOT/.server.pid"
URL="http://127.0.0.1:$PORT"

cd "$ROOT"

# 1) 已在运行则直接返回
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  if curl -sf --max-time 3 "$URL/healthz" >/dev/null 2>&1; then
    echo "[start] 服务已在运行 (pid $(cat "$PIDFILE"))"
    REPORT=1
  fi
fi

# 2) 清理残留进程 / 端口占用
if [ -z "${REPORT:-}" ]; then
  if [ -f "$PIDFILE" ]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "$PORT/tcp" >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:$PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
  fi
  sleep 0.5

  # 3) 后台启动（必须监听 0.0.0.0 才能被网关转发）
  PORT="$PORT" HOST=0.0.0.0 nohup node "$ROOT/server.js" >> "$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  sleep 1.2
fi

# 4) 健康检查
if curl -sf --max-time 5 "$URL/healthz" >/dev/null 2>&1; then
  echo "[start] 健康检查通过 -> $URL/healthz"
else
  echo "[start] 启动失败，日志末尾："
  tail -n 20 "$LOG" 2>/dev/null
  exit 1
fi

# 5) 输出可访问的网关地址
if [ -n "${CNB_VSCODE_PROXY_URI:-}" ]; then
  PREVIEW="$(printf '%s' "$CNB_VSCODE_PROXY_URI" | sed "s/{{port}}/$PORT/g")"
  echo "[start] 预览地址: $PREVIEW"
else
  echo "[start] 预览地址: $URL"
fi
