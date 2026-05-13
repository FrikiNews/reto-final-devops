# Zenta — Inteligencia Financiera para PyMEs

Stack completo con React + Node.js + MongoDB.

## Estructura

```
Reto Final/
├── backend/          Node.js + Express + Mongoose
│   └── src/
│       ├── config/   Conexión a MongoDB
│       ├── models/   User, Empresa, Movimiento, Factura, Alerta, Proyeccion
│       ├── routes/   auth, dashboard, empresas, movimientos, facturas, alertas, proyecciones
│       ├── middleware/ JWT auth
│       └── seed.js   Datos de prueba
├── landing/          React/Vite — Página pública
├── intranet/         React/Vite — Panel interno con autenticación
└── docker-compose.yml
```

## Requisitos

- Docker & Docker Compose **ó** Node.js 20+

## Levantar con Docker (recomendado)

```bash
cp .env.example .env
docker compose up --build
```

| Servicio | URL                   |
| -------- | --------------------- |
| Landing  | http://localhost      |
| Intranet | http://localhost:8080 |
| API      | http://localhost:5000 |
| MongoDB  | localhost:27017       |

Poblar con datos de prueba:

```bash
docker compose exec backend npm run seed
```

## Desarrollo local

### Backend

```bash
cd backend
cp ../.env.example .env   # ajusta MONGODB_URI
npm install
npm run seed
npm run dev               # nodemon en :5000
```

### Landing

```bash
cd landing
npm install
npm run dev               # Vite en :3000
```

### Intranet

```bash
cd intranet
npm install
npm run dev               # Vite en :3001
```

## Credenciales de prueba

```
Email:    admin@zenta.mx
Password: zenta2024
```

## API Endpoints

| Método | Ruta                         | Descripción           |
| ------ | ---------------------------- | --------------------- |
| POST   | /api/auth/login              | Login → JWT           |
| GET    | /api/auth/me                 | Usuario autenticado   |
| GET    | /api/dashboard/:empresaId    | KPIs del dashboard    |
| GET    | /api/facturas/:empresaId     | Listar facturas       |
| POST   | /api/facturas                | Crear factura         |
| PATCH  | /api/facturas/:id            | Actualizar factura    |
| GET    | /api/alertas/:empresaId      | Listar alertas        |
| PATCH  | /api/alertas/:id/resolver    | Marcar resuelta       |
| GET    | /api/movimientos/:empresaId  | Listar movimientos    |
| POST   | /api/movimientos             | Registrar movimiento  |
| GET    | /api/proyecciones/:empresaId | Proyección financiera |
