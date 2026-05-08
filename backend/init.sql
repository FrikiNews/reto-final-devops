-- ============================================================
--  Zenta — Schema PostgreSQL
--  Base de datos: zenta_db
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- Tabla: empresas  (cada empresa es un cliente de Zenta)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    rfc           VARCHAR(13)  UNIQUE NOT NULL,
    sector        VARCHAR(80),
    plan          VARCHAR(20)  NOT NULL DEFAULT 'basico'  -- basico | pro | enterprise
                               CHECK (plan IN ('basico', 'pro', 'enterprise')),
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Tabla: clientes  (clientes/deudores de cada empresa)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
    id            SERIAL PRIMARY KEY,
    empresa_id    INT          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre        VARCHAR(150) NOT NULL,
    rfc           VARCHAR(13),
    sector        VARCHAR(80),
    dias_cobro    INT          NOT NULL DEFAULT 30,
    nivel_riesgo  VARCHAR(10)  NOT NULL DEFAULT 'bajo'
                               CHECK (nivel_riesgo IN ('bajo', 'medio', 'alto')),
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Tabla: facturas  (cuentas por cobrar)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
    id              SERIAL PRIMARY KEY,
    empresa_id      INT             NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id      INT             NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    numero_factura  VARCHAR(30)     NOT NULL,
    monto           NUMERIC(14, 2)  NOT NULL CHECK (monto > 0),
    fecha_emision   DATE            NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE          NOT NULL,
    fecha_cobro     DATE,
    estado          VARCHAR(15)     NOT NULL DEFAULT 'pendiente'
                                   CHECK (estado IN ('pendiente', 'cobrada', 'vencida', 'incobrable')),
    observaciones   TEXT,
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Tabla: movimientos  (ingresos y egresos reales)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos (
    id          SERIAL PRIMARY KEY,
    empresa_id  INT             NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo        VARCHAR(7)      NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
    concepto    VARCHAR(200)    NOT NULL,
    monto       NUMERIC(14, 2)  NOT NULL CHECK (monto > 0),
    fecha       DATE            NOT NULL DEFAULT CURRENT_DATE,
    categoria   VARCHAR(60),    -- nómina, renta, cobro_cliente, proveedor, etc.
    factura_id  INT             REFERENCES facturas(id) ON DELETE SET NULL,
    creado_en   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Tabla: proyecciones  (resultados del modelo predictivo)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyecciones (
    id              SERIAL PRIMARY KEY,
    empresa_id      INT             NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    horizonte_dias  INT             NOT NULL CHECK (horizonte_dias IN (30, 60, 90)),
    flujo_neto      NUMERIC(14, 2)  NOT NULL,
    runway_meses    NUMERIC(5, 2)   NOT NULL,
    margen_operativo NUMERIC(6, 2),
    punto_riesgo    VARCHAR(60),    -- "Semana 5", etc.
    supuestos       JSONB,          -- parámetros usados en el modelo
    generado_en     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Tabla: alertas
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertas (
    id              SERIAL PRIMARY KEY,
    empresa_id      INT         NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    prioridad       VARCHAR(10) NOT NULL DEFAULT 'info'
                                CHECK (prioridad IN ('critica', 'atencion', 'info')),
    titulo          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    impacto_flujo   NUMERIC(14, 2),
    dias_para_crisis INT,
    accion_sugerida TEXT,
    resuelta        BOOLEAN     NOT NULL DEFAULT FALSE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelta_en     TIMESTAMPTZ
);

-- ─────────────────────────────────────────────
-- Tabla: escenarios  (simulaciones guardadas)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escenarios (
    id              SERIAL PRIMARY KEY,
    empresa_id      INT            NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre          VARCHAR(100)   NOT NULL,
    cambio_ingresos NUMERIC(6, 2)  NOT NULL DEFAULT 0,   -- % relativo
    nuevos_empleados INT           NOT NULL DEFAULT 0,
    reduccion_cobro INT            NOT NULL DEFAULT 0,   -- días
    incremento_precio NUMERIC(6,2) NOT NULL DEFAULT 0,   -- %
    runway_resultado NUMERIC(5, 2),
    flujo_resultado  NUMERIC(14, 2),
    margen_resultado NUMERIC(6, 2),
    creado_en       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Tabla: benchmarks  (datos sectoriales agregados)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS benchmarks (
    id              SERIAL PRIMARY KEY,
    sector          VARCHAR(80) NOT NULL,
    indicador       VARCHAR(80) NOT NULL,  -- 'margen_operativo', 'dias_cobro', etc.
    valor_promedio  NUMERIC(10, 4) NOT NULL,
    valor_p25       NUMERIC(10, 4),
    valor_p75       NUMERIC(10, 4),
    periodo         VARCHAR(10) NOT NULL,  -- 'Q1-2026', etc.
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Índices frecuentes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_facturas_empresa    ON facturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado     ON facturas(estado);
CREATE INDEX IF NOT EXISTS idx_movimientos_empresa ON movimientos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha   ON movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_alertas_empresa     ON alertas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alertas_resuelta    ON alertas(empresa_id, resuelta);
CREATE INDEX IF NOT EXISTS idx_proyecciones_emp    ON proyecciones(empresa_id, generado_en DESC);

-- ─────────────────────────────────────────────
-- Datos semilla (empresa demo)
-- ─────────────────────────────────────────────
INSERT INTO empresas (nombre, rfc, sector, plan) VALUES
    ('Distribuidora Pérez S.A.', 'DPE920415ABC', 'Comercio / Distribución', 'pro')
ON CONFLICT (rfc) DO NOTHING;

INSERT INTO clientes (empresa_id, nombre, rfc, sector, dias_cobro, nivel_riesgo) VALUES
    (1, 'Arco Industrial S.A.',  'AIS920415XYZ', 'Manufactura', 54, 'alto'),
    (1, 'Grupo Nexus',           'GNX010830ABC', 'Comercio',    41, 'medio'),
    (1, 'Solaris Retail',        'SRL050712DEF', 'Retail',      28, 'bajo'),
    (1, 'TechMex Norte',         'TMN180923GHI', 'Tecnología',  20, 'bajo'),
    (1, 'Logística Sur',         'LSR990204JKL', 'Logística',   15, 'bajo')
ON CONFLICT DO NOTHING;

INSERT INTO facturas (empresa_id, cliente_id, numero_factura, monto, fecha_emision, fecha_vencimiento, estado) VALUES
    (1, 1, 'F-3028', 94000.00, '2026-03-15', '2026-04-14', 'vencida'),
    (1, 2, 'F-3031', 62000.00, '2026-03-28', '2026-04-27', 'vencida'),
    (1, 3, 'F-3037', 34000.00, '2026-04-10', '2026-05-10', 'pendiente'),
    (1, 4, 'F-3039', 18500.00, '2026-04-18', '2026-05-18', 'pendiente'),
    (1, 5, 'F-3041',  9500.00, '2026-05-01', '2026-05-31', 'pendiente')
ON CONFLICT DO NOTHING;

INSERT INTO movimientos (empresa_id, tipo, concepto, monto, fecha, categoria) VALUES
    (1, 'ingreso', 'Cobro — Cliente Arco S.A.',      85000.00, '2026-05-08', 'cobro_cliente'),
    (1, 'egreso',  'Pago nómina — Mayo',             62000.00, '2026-05-07', 'nomina'),
    (1, 'egreso',  'Renta bodega Tlalnepantla',       18500.00, '2026-05-06', 'renta'),
    (1, 'ingreso', 'Cobro — Cliente Solaris',         42000.00, '2026-05-05', 'cobro_cliente'),
    (1, 'egreso',  'Factura F-3041 — Provee Sur',     31200.00, '2026-05-04', 'proveedor')
ON CONFLICT DO NOTHING;

INSERT INTO alertas (empresa_id, prioridad, titulo, descripcion, impacto_flujo, dias_para_crisis, accion_sugerida) VALUES
    (1, 'critica',  'Flujo proyectado negativo si Arco no paga',  'Cliente Arco tiene factura F-3028 con 54 días vencida.',               -94000, 38, 'Llamar a cliente, considerar factoraje'),
    (1, 'critica',  'Margen de seguridad bajo umbral mínimo',      'El colchón financiero cayó por debajo de $50,000.',                   -38200, 22, 'Activar línea de crédito revolvente'),
    (1, 'atencion', '3 facturas con +45 días sin cobrar',          'Facturas F-3028, F-3031 acumulan $156,000 sin cobrar.',               -89000, 65, 'Iniciar cobranza formal o negociar pago parcial'),
    (1, 'info',     'Días de cobro mejoraron 8 días vs sector',    'Benchmark: ciclo de cobro actual 38d vs 46d del sector.', 12000, NULL, 'Mantener política de cobro actual')
ON CONFLICT DO NOTHING;

INSERT INTO benchmarks (sector, indicador, valor_promedio, valor_p25, valor_p75, periodo) VALUES
    ('Comercio / Distribución', 'margen_operativo',     22.2, 15.0, 30.0, 'Q1-2026'),
    ('Comercio / Distribución', 'dias_cobro',           46.0, 30.0, 65.0, 'Q1-2026'),
    ('Comercio / Distribución', 'runway_meses',          3.8,  2.0,  6.0, 'Q1-2026'),
    ('Comercio / Distribución', 'gastos_fijos_ratio',   71.4, 55.0, 85.0, 'Q1-2026'),
    ('Comercio / Distribución', 'deuda_activos_ratio',  35.0, 20.0, 55.0, 'Q1-2026')
ON CONFLICT DO NOTHING;
