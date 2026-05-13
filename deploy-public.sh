#!/usr/bin/env bash
# =============================================================================
#  Zenta — Script de despliegue EC2 PÚBLICA
#  Instala Docker, clona el repo y levanta: MongoDB + Backend + Landing Page
#
#  Uso:
#    chmod +x deploy-public.sh
#    sudo ./deploy-public.sh
#
#  Variables opcionales (se pueden exportar antes de correr):
#    REPO_URL      — URL del repo Git (default: repo de GitHub)
#    JWT_SECRET    — Secreto JWT para producción
#    EFIRMA_SECRET — Clave AES-256 para e.firma
#    MONGO_PASS    — Contraseña de MongoDB
# =============================================================================
set -euo pipefail

# ── Configuración ─────────────────────────────────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/FrikiNews/reto-final-devops.git}"
APP_DIR="/opt/zenta"
COMPOSE_FILE="docker-compose.public.yml"

# Valores por defecto (cámbia en producción real)
MONGO_USER="${MONGO_USER:-zenta}"
MONGO_PASS="${MONGO_PASS:-zentapass}"
MONGO_DB="${MONGO_DB:-zenta_db}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
EFIRMA_SECRET="${EFIRMA_SECRET:-$(openssl rand -hex 32)}"

# ── Colores ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Verificar root ────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Ejecuta con sudo: sudo ./deploy-public.sh"

info "=== Zenta — Despliegue EC2 Pública (Landing Page) ==="

# ── 1. Instalar Docker ────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Instalando Docker..."
  if command -v yum &>/dev/null; then
    # Amazon Linux 2 / RHEL
    yum update -y
    yum install -y docker git
    systemctl enable docker
    systemctl start docker
  elif command -v apt-get &>/dev/null; then
    # Ubuntu / Debian
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg git
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
  else
    error "Distribución no soportada. Instala Docker manualmente."
  fi
  info "Docker instalado correctamente."
else
  info "Docker ya instalado: $(docker --version)"
fi

# Instalar docker compose plugin si falta
if ! docker compose version &>/dev/null; then
  info "Instalando Docker Compose plugin..."
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

# ── 2. Clonar o actualizar el repositorio ─────────────────────────────────────
if [[ -d "$APP_DIR/.git" ]]; then
  info "Repositorio existente — actualizando..."
  cd "$APP_DIR"
  git pull origin master
else
  info "Clonando repositorio en $APP_DIR..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 3. Crear archivo .env del backend ─────────────────────────────────────────
info "Configurando variables de entorno..."
cat > "$APP_DIR/backend/.env" <<EOF
# Generado automáticamente por deploy-public.sh — $(date)
NODE_ENV=production
PORT=5000

MONGO_USER=${MONGO_USER}
MONGO_PASS=${MONGO_PASS}
MONGO_DB=${MONGO_DB}
MONGODB_URI=mongodb://${MONGO_USER}:${MONGO_PASS}@mongo:27017/${MONGO_DB}?authSource=admin

JWT_SECRET=${JWT_SECRET}
EFIRMA_SECRET=${EFIRMA_SECRET}
CORS_ORIGIN=*
EOF
chmod 600 "$APP_DIR/backend/.env"
info ".env creado en backend/.env"

# ── 4. Levantar servicios ─────────────────────────────────────────────────────
info "Construyendo imágenes y levantando contenedores..."
cd "$APP_DIR"
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d --build

# ── 5. Esperar a que el backend esté listo ────────────────────────────────────
info "Esperando que el backend esté listo..."
for i in $(seq 1 30); do
  if docker exec zenta_backend wget -qO- http://localhost:5000/health &>/dev/null; then
    info "Backend listo."
    break
  fi
  [[ $i -eq 30 ]] && error "Backend no respondió en 60s. Revisa: docker logs zenta_backend"
  sleep 2
done

# ── 6. Sembrar datos de prueba ────────────────────────────────────────────────
info "Cargando datos de prueba..."
docker exec zenta_backend node src/seed.js

# ── 7. Estado final ───────────────────────────────────────────────────────────
echo ""
info "=== Despliegue completado ==="
docker compose -f "$COMPOSE_FILE" ps
echo ""
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || curl -s https://checkip.amazonaws.com 2>/dev/null || hostname -I | awk '{print $1}')
echo -e "${GREEN}Landing Page disponible en:${NC} http://${PUBLIC_IP}"
echo ""
warn "Asegúrate de que el Security Group de esta EC2 tenga el puerto 80 abierto al público (0.0.0.0/0)."
warn "IMPORTANTE: Cambia los secretos JWT/EFIRMA en producción real."
