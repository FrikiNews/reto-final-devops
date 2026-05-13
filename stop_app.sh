#!/usr/bin/env bash
# =============================================================================
#  Zenta — Detener servicios
#  Para los contenedores y guarda logs finales con timestamp
#
#  Uso:
#    chmod +x stop_app.sh
#    sudo ./stop_app.sh
#    sudo ./stop_app.sh public    # para la EC2 pública (landing)
#    sudo ./stop_app.sh private   # para la EC2 privada (intranet)  [default]
# =============================================================================
set -euo pipefail

# ── Configuración ─────────────────────────────────────────────────────────────
APP_DIR="/opt/zenta"
ENV="${1:-private}"
LOG_DIR="$APP_DIR/logs"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')

if [[ "$ENV" == "public" ]]; then
  COMPOSE_FILE="docker-compose.public.yml"
else
  COMPOSE_FILE="docker-compose.private.yml"
fi

# ── Colores ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*" | tee -a "$LOG_DIR/stop_$TIMESTAMP.log"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*" | tee -a "$LOG_DIR/stop_$TIMESTAMP.log"; }
error() { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_DIR/stop_$TIMESTAMP.log"; exit 1; }

# ── Verificar root ────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Ejecuta con sudo: sudo ./stop_app.sh"

# ── Crear directorio de logs (por si acaso) ───────────────────────────────────
mkdir -p "$LOG_DIR"

info "=== Zenta — Deteniendo servicios ($ENV) — $TIMESTAMP ==="

cd "$APP_DIR"

# ── Guardar logs finales antes de detener ─────────────────────────────────────
info "Guardando snapshot de logs antes de detener..."
docker compose -f "$COMPOSE_FILE" logs --no-color \
  >> "$LOG_DIR/final_snapshot_$TIMESTAMP.log" 2>&1 || true
info "Snapshot guardado en: $LOG_DIR/final_snapshot_$TIMESTAMP.log"

# ── Detener proceso de logs en background (si existe) ─────────────────────────
if [[ -f "$LOG_DIR/logs_pid.txt" ]]; then
  LOGS_PID=$(cat "$LOG_DIR/logs_pid.txt")
  if kill -0 "$LOGS_PID" 2>/dev/null; then
    kill "$LOGS_PID"
    info "Proceso de logs (PID $LOGS_PID) detenido."
  fi
  rm -f "$LOG_DIR/logs_pid.txt"
fi

# ── Detener contenedores ──────────────────────────────────────────────────────
info "Deteniendo contenedores..."
docker compose -f "$COMPOSE_FILE" down 2>&1 | tee -a "$LOG_DIR/stop_$TIMESTAMP.log"

# ── Estado final ──────────────────────────────────────────────────────────────
echo "" | tee -a "$LOG_DIR/stop_$TIMESTAMP.log"
info "=== Servicios detenidos correctamente ==="
info "Logs guardados en: $LOG_DIR/"
