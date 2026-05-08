import logging
import os
from datetime import date, datetime
from decimal import Decimal

import psycopg2
import psycopg2.extras
from flask import Flask, jsonify, request
from flask_cors import CORS

# ──────────────────────────────────────────────
# Logging  →  /app/logs/app.log  +  stdout
# ──────────────────────────────────────────────
LOG_DIR = os.getenv("LOG_DIR", "/app/logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, "app.log")),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Flask app
# ──────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # permite peticiones desde el frontend (mismo dominio en prod)

# ──────────────────────────────────────────────
# Conexión a PostgreSQL
# ──────────────────────────────────────────────
DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "db"),
    "port":     int(os.getenv("DB_PORT", "5432")),
    "dbname":   os.getenv("DB_NAME",     "zenta_db"),
    "user":     os.getenv("DB_USER",     "zenta_user"),
    "password": os.getenv("DB_PASSWORD", "zenta_pass"),
}


def get_db():
    """Abre una conexión nueva por petición (simple; no necesita pool en esta escala)."""
    return psycopg2.connect(
        **DB_CONFIG,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def serialize(obj):
    """Convierte tipos no-JSON-serializables devueltos por psycopg2."""
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def rows_to_json(rows):
    import json
    return json.loads(json.dumps([dict(r) for r in rows], default=serialize))


# ──────────────────────────────────────────────
# Health-check
# ──────────────────────────────────────────────
@app.route("/health")
def health():
    try:
        conn = get_db()
        conn.close()
        logger.info("Health-check OK")
        return jsonify({"status": "ok"}), 200
    except Exception as exc:
        logger.error("Health-check FAIL: %s", exc)
        return jsonify({"status": "error", "detail": str(exc)}), 500


# ──────────────────────────────────────────────
# DASHBOARD — KPIs resumidos
# ──────────────────────────────────────────────
@app.route("/api/dashboard/<int:empresa_id>")
def dashboard(empresa_id):
    """Devuelve los KPIs principales para el panel de inicio."""
    try:
        conn = get_db()
        cur  = conn.cursor()

        # Runway (última proyección a 30d)
        cur.execute(
            """
            SELECT runway_meses, flujo_neto
            FROM proyecciones
            WHERE empresa_id = %s AND horizonte_dias = 30
            ORDER BY generado_en DESC LIMIT 1
            """,
            (empresa_id,),
        )
        proj = cur.fetchone()

        # Facturas vencidas
        cur.execute(
            """
            SELECT COUNT(*) AS cantidad,
                   COALESCE(SUM(monto), 0) AS total
            FROM facturas
            WHERE empresa_id = %s AND estado IN ('pendiente', 'vencida')
            """,
            (empresa_id,),
        )
        cxc = cur.fetchone()

        # Alertas activas
        cur.execute(
            """
            SELECT COUNT(*) FILTER (WHERE prioridad = 'critica')  AS criticas,
                   COUNT(*) FILTER (WHERE prioridad = 'atencion') AS atencion,
                   COUNT(*) FILTER (WHERE prioridad = 'info')     AS info
            FROM alertas
            WHERE empresa_id = %s AND resuelta = FALSE
            """,
            (empresa_id,),
        )
        alerts = cur.fetchone()

        # Margen operativo (últimos 3 meses)
        cur.execute(
            """
            SELECT COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso'), 0) AS ingresos,
                   COALESCE(SUM(monto) FILTER (WHERE tipo = 'egreso'),  0) AS egresos
            FROM movimientos
            WHERE empresa_id = %s
              AND fecha >= CURRENT_DATE - INTERVAL '90 days'
            """,
            (empresa_id,),
        )
        flujo = cur.fetchone()

        conn.close()

        ingresos = float(flujo["ingresos"])
        egresos  = float(flujo["egresos"])
        margen   = round((ingresos - egresos) / ingresos * 100, 2) if ingresos else 0

        result = {
            "runway_meses":  float(proj["runway_meses"]) if proj else None,
            "flujo_30d":     float(proj["flujo_neto"])   if proj else None,
            "facturas_total": float(cxc["total"]),
            "facturas_cantidad": int(cxc["cantidad"]),
            "alertas": dict(alerts),
            "margen_operativo": margen,
        }
        logger.info("Dashboard empresa=%s OK", empresa_id)
        return jsonify(result), 200

    except Exception as exc:
        logger.error("Dashboard empresa=%s ERR: %s", empresa_id, exc)
        return jsonify({"error": str(exc)}), 500


# ──────────────────────────────────────────────
# PROYECCIONES
# ──────────────────────────────────────────────
@app.route("/api/proyecciones/<int:empresa_id>")
def get_proyecciones(empresa_id):
    horizonte = request.args.get("horizonte", 30, type=int)
    if horizonte not in (30, 60, 90):
        return jsonify({"error": "horizonte debe ser 30, 60 o 90"}), 400
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            """
            SELECT * FROM proyecciones
            WHERE empresa_id = %s AND horizonte_dias = %s
            ORDER BY generado_en DESC LIMIT 1
            """,
            (empresa_id, horizonte),
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            return jsonify({"error": "Sin proyección disponible"}), 404
        return jsonify(rows_to_json([row])[0]), 200
    except Exception as exc:
        logger.error("Proyecciones ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/proyecciones/<int:empresa_id>", methods=["POST"])
def crear_proyeccion(empresa_id):
    """Guarda una nueva proyección generada por el modelo."""
    data = request.get_json(silent=True) or {}
    required = ("horizonte_dias", "flujo_neto", "runway_meses")
    if not all(k in data for k in required):
        return jsonify({"error": f"Campos requeridos: {required}"}), 400
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            """
            INSERT INTO proyecciones
                (empresa_id, horizonte_dias, flujo_neto, runway_meses,
                 margen_operativo, punto_riesgo, supuestos)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                empresa_id,
                data["horizonte_dias"],
                data["flujo_neto"],
                data["runway_meses"],
                data.get("margen_operativo"),
                data.get("punto_riesgo"),
                psycopg2.extras.Json(data.get("supuestos")),
            ),
        )
        new_id = cur.fetchone()["id"]
        conn.commit()
        conn.close()
        logger.info("Proyección creada id=%s empresa=%s", new_id, empresa_id)
        return jsonify({"id": new_id}), 201
    except Exception as exc:
        logger.error("Crear proyección ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


# ──────────────────────────────────────────────
# ALERTAS
# ──────────────────────────────────────────────
@app.route("/api/alertas/<int:empresa_id>")
def get_alertas(empresa_id):
    solo_activas = request.args.get("activas", "true").lower() == "true"
    try:
        conn = get_db()
        cur  = conn.cursor()
        query = "SELECT * FROM alertas WHERE empresa_id = %s"
        params = [empresa_id]
        if solo_activas:
            query += " AND resuelta = FALSE"
        query += " ORDER BY CASE prioridad WHEN 'critica' THEN 1 WHEN 'atencion' THEN 2 ELSE 3 END, creado_en DESC"
        cur.execute(query, params)
        rows = cur.fetchall()
        conn.close()
        return jsonify(rows_to_json(rows)), 200
    except Exception as exc:
        logger.error("Alertas ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/alertas/<int:empresa_id>/<int:alerta_id>/resolver", methods=["PATCH"])
def resolver_alerta(empresa_id, alerta_id):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            """
            UPDATE alertas
               SET resuelta = TRUE, resuelta_en = NOW()
             WHERE id = %s AND empresa_id = %s
            RETURNING id
            """,
            (alerta_id, empresa_id),
        )
        row = cur.fetchone()
        conn.commit()
        conn.close()
        if not row:
            return jsonify({"error": "Alerta no encontrada"}), 404
        logger.info("Alerta resuelta id=%s empresa=%s", alerta_id, empresa_id)
        return jsonify({"id": row["id"], "resuelta": True}), 200
    except Exception as exc:
        logger.error("Resolver alerta ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


# ──────────────────────────────────────────────
# CUENTAS POR COBRAR — Facturas
# ──────────────────────────────────────────────
@app.route("/api/facturas/<int:empresa_id>")
def get_facturas(empresa_id):
    estado = request.args.get("estado")  # pendiente | vencida | cobrada
    try:
        conn = get_db()
        cur  = conn.cursor()
        query = """
            SELECT f.*, c.nombre AS cliente_nombre, c.nivel_riesgo,
                   (CURRENT_DATE - f.fecha_vencimiento) AS dias_vencida
            FROM facturas f
            JOIN clientes c ON c.id = f.cliente_id
            WHERE f.empresa_id = %s
        """
        params = [empresa_id]
        if estado:
            query += " AND f.estado = %s"
            params.append(estado)
        query += " ORDER BY dias_vencida DESC, f.monto DESC"
        cur.execute(query, params)
        rows = cur.fetchall()
        conn.close()
        return jsonify(rows_to_json(rows)), 200
    except Exception as exc:
        logger.error("Facturas ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/facturas/<int:empresa_id>/cobro", methods=["POST"])
def registrar_cobro(empresa_id):
    """Marca una factura como cobrada y registra el movimiento de ingreso."""
    data = request.get_json(silent=True) or {}
    required = ("factura_id", "monto_cobrado", "fecha_cobro")
    if not all(k in data for k in required):
        return jsonify({"error": f"Campos requeridos: {required}"}), 400
    try:
        conn = get_db()
        cur  = conn.cursor()

        # Validar que la factura pertenezca a esta empresa
        cur.execute(
            "SELECT id, monto FROM facturas WHERE id = %s AND empresa_id = %s",
            (data["factura_id"], empresa_id),
        )
        factura = cur.fetchone()
        if not factura:
            conn.close()
            return jsonify({"error": "Factura no encontrada"}), 404

        # Actualizar estado de la factura
        cur.execute(
            """
            UPDATE facturas
               SET estado = 'cobrada', fecha_cobro = %s, observaciones = %s
             WHERE id = %s
            """,
            (data["fecha_cobro"], data.get("observaciones", ""), data["factura_id"]),
        )

        # Registrar movimiento de ingreso
        cur.execute(
            """
            INSERT INTO movimientos
                (empresa_id, tipo, concepto, monto, fecha, categoria, factura_id)
            VALUES (%s, 'ingreso', %s, %s, %s, 'cobro_cliente', %s)
            RETURNING id
            """,
            (
                empresa_id,
                f"Cobro factura #{data['factura_id']}",
                data["monto_cobrado"],
                data["fecha_cobro"],
                data["factura_id"],
            ),
        )
        mov_id = cur.fetchone()["id"]
        conn.commit()
        conn.close()
        logger.info("Cobro registrado factura=%s movimiento=%s empresa=%s",
                    data["factura_id"], mov_id, empresa_id)
        return jsonify({"movimiento_id": mov_id}), 201
    except Exception as exc:
        logger.error("Registrar cobro ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


# ──────────────────────────────────────────────
# MOVIMIENTOS (historial de flujo)
# ──────────────────────────────────────────────
@app.route("/api/movimientos/<int:empresa_id>")
def get_movimientos(empresa_id):
    limit = request.args.get("limit", 50, type=int)
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            """
            SELECT * FROM movimientos
            WHERE empresa_id = %s
            ORDER BY fecha DESC, id DESC
            LIMIT %s
            """,
            (empresa_id, min(limit, 200)),
        )
        rows = cur.fetchall()
        conn.close()
        return jsonify(rows_to_json(rows)), 200
    except Exception as exc:
        logger.error("Movimientos ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


# ──────────────────────────────────────────────
# ESCENARIOS
# ──────────────────────────────────────────────
@app.route("/api/escenarios/<int:empresa_id>")
def get_escenarios(empresa_id):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "SELECT * FROM escenarios WHERE empresa_id = %s ORDER BY creado_en DESC",
            (empresa_id,),
        )
        rows = cur.fetchall()
        conn.close()
        return jsonify(rows_to_json(rows)), 200
    except Exception as exc:
        logger.error("Escenarios ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/escenarios/<int:empresa_id>", methods=["POST"])
def guardar_escenario(empresa_id):
    data = request.get_json(silent=True) or {}
    if not data.get("nombre"):
        return jsonify({"error": "El campo 'nombre' es requerido"}), 400
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            """
            INSERT INTO escenarios
                (empresa_id, nombre, cambio_ingresos, nuevos_empleados,
                 reduccion_cobro, incremento_precio,
                 runway_resultado, flujo_resultado, margen_resultado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                empresa_id,
                data["nombre"],
                data.get("cambio_ingresos", 0),
                data.get("nuevos_empleados", 0),
                data.get("reduccion_cobro", 0),
                data.get("incremento_precio", 0),
                data.get("runway_resultado"),
                data.get("flujo_resultado"),
                data.get("margen_resultado"),
            ),
        )
        new_id = cur.fetchone()["id"]
        conn.commit()
        conn.close()
        logger.info("Escenario guardado id=%s empresa=%s", new_id, empresa_id)
        return jsonify({"id": new_id}), 201
    except Exception as exc:
        logger.error("Guardar escenario ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


# ──────────────────────────────────────────────
# CLIENTES
# ──────────────────────────────────────────────
@app.route("/api/clientes/<int:empresa_id>")
def get_clientes(empresa_id):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            """
            SELECT c.*,
                   COALESCE(SUM(f.monto) FILTER (WHERE f.estado IN ('pendiente','vencida')), 0)
                       AS facturas_pendientes
            FROM clientes c
            LEFT JOIN facturas f ON f.cliente_id = c.id
            WHERE c.empresa_id = %s AND c.activo = TRUE
            GROUP BY c.id
            ORDER BY facturas_pendientes DESC
            """,
            (empresa_id,),
        )
        rows = cur.fetchall()
        conn.close()
        return jsonify(rows_to_json(rows)), 200
    except Exception as exc:
        logger.error("Clientes ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


# ──────────────────────────────────────────────
# BENCHMARKING
# ──────────────────────────────────────────────
@app.route("/api/benchmark")
def get_benchmark():
    sector = request.args.get("sector", "Comercio / Distribución")
    periodo = request.args.get("periodo", "Q1-2026")
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "SELECT * FROM benchmarks WHERE sector = %s AND periodo = %s",
            (sector, periodo),
        )
        rows = cur.fetchall()
        conn.close()
        return jsonify(rows_to_json(rows)), 200
    except Exception as exc:
        logger.error("Benchmark ERR: %s", exc)
        return jsonify({"error": str(exc)}), 500


# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────
if __name__ == "__main__":
    logger.info("Iniciando Zenta API en puerto 5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
