#!/usr/bin/env bash
# =============================================================================
#  Zenta — Iniciar servicios
#  Levanta los contenedores y guarda logs con timestamp
#
#  Uso:
#    chmod +x start_app.sh
#    sudo ./start_app.sh
#    sudo ./start_app.sh public    # para la EC2 pública (landing)
#    sudo ./start_app.sh private   # para la EC2 privada (intranet)  [default]
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
info()  { echo -e "${GREEN}[INFO]${NC}  $*" | tee -a "$LOG_DIR/start_$TIMESTAMP.log"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*" | tee -a "$LOG_DIR/start_$TIMESTAMP.log"; }
error() { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_DIR/start_$TIMESTAMP.log"; exit 1; }

# ── Verificar root ────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Ejecuta con sudo: sudo ./start_app.sh"

# ── Crear directorio de logs ──────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

info "=== Zenta — Iniciando servicios ($ENV) — $TIMESTAMP ==="

cd "$APP_DIR"

# ── Verificar que Docker está corriendo ───────────────────────────────────────
if ! systemctl is-active --quiet docker; then
  info "Iniciando servicio Docker..."
  systemctl start docker
fi

# ── Levantar contenedores ─────────────────────────────────────────────────────
info "Levantando contenedores con $COMPOSE_FILE..."
docker compose -f "$COMPOSE_FILE" up -d 2>&1 | tee -a "$LOG_DIR/start_$TIMESTAMP.log"

# ── Esperar al backend ────────────────────────────────────────────────────────
info "Esperando que el backend esté listo..."
for i in $(seq 1 30); do
  if docker exec zenta_backend wget -qO- http://localhost:5000/health &>/dev/null; then
    info "Backend listo."
    break
  fi
  [[ $i -eq 30 ]] && error "Backend no respondió en 60s. Revisa los logs: $LOG_DIR/"
  sleep 2
done

# ── Guardar logs de contenedores en background ────────────────────────────────
info "Guardando logs de contenedores en $LOG_DIR/containers_$TIMESTAMP.log ..."
nohup docker compose -f "$COMPOSE_FILE" logs -f --no-color \
  >> "$LOG_DIR/containers_$TIMESTAMP.log" 2>&1 &
echo $! > "$LOG_DIR/logs_pid.txt"
info "PID del proceso de logs: $(cat "$LOG_DIR/logs_pid.txt")"

# ── Estado final ──────────────────────────────────────────────────────────────
echo "" | tee -a "$LOG_DIR/start_$TIMESTAMP.log"
info "=== Servicios activos ==="
docker compose -f "$COMPOSE_FILE" ps 2>&1 | tee -a "$LOG_DIR/start_$TIMESTAMP.log"
echo "" | tee -a "$LOG_DIR/start_$TIMESTAMP.log"
info "Logs disponibles en: $LOG_DIR/"
info "Para ver logs en tiempo real: tail -f $LOG_DIR/containers_$TIMESTAMP.log"
