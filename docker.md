# Docker and AWS ECS Fargate Deployment Guide

This repository contains a containerized React frontend, FastAPI backend, and local MongoDB compose setup suitable for production-oriented testing before deploying the application to AWS ECS Fargate.

## Created deployment files

### `.dockerignore`
Root-level Docker ignore file used when building images from the repository root. It excludes Git metadata, local Node dependencies, frontend build output, backend caches, uploaded files, environment files, coverage output, and logs so Docker build contexts stay small and do not include secrets or local artifacts.

### `frontend/Dockerfile`
Production multi-stage Dockerfile for the React application.

- Uses `node:22-alpine` for the build stage.
- Installs dependencies with `npm ci`.
- Runs `npm run build` to generate static assets.
- Uses `nginx:alpine` for the runtime stage.
- Copies the compiled React build into nginx's web root.
- Exposes port `80`, which is compatible with ECS Fargate container port mappings and Application Load Balancer target groups.
- Runs a startup script that writes runtime configuration into `env-config.js`.

### `frontend/.dockerignore`
Frontend-specific Docker ignore file used by the frontend build context. It excludes `node_modules`, build output, caches, local environment files, debug logs, and Git metadata from the frontend image build.

### `frontend/docker/nginx.conf.template`
Nginx configuration template rendered by the official nginx container entrypoint at startup.

- Serves the React single-page application.
- Provides a `/health` endpoint for container or load balancer health checks.
- Serves `/env-config.js` with no-cache headers so runtime configuration changes are not stale.
- Proxies `/api/` and `/uploads/` to `NGINX_API_PROXY` for local compose-based testing or same-origin deployments.
- Falls back to `index.html` for client-side routing.

### `frontend/docker/99-runtime-config.sh`
Nginx entrypoint script that generates `/usr/share/nginx/html/env-config.js` at container startup from environment variables.

This allows the same immutable frontend image to be reused across environments while ECS task definitions inject values such as `REACT_APP_BACKEND_URL` at runtime.

### `frontend/public/env-config.js`
Development and build-time placeholder for runtime configuration. The nginx entrypoint overwrites this file in the production container.

### `frontend/src/config/runtimeConfig.js`
Central frontend runtime configuration module.

It reads `REACT_APP_BACKEND_URL` from `window.__APP_CONFIG__` first, then falls back to the standard Create React App build-time environment variable. API clients consume this module so backend URLs are configurable rather than hardcoded.

### `backend/Dockerfile`
Production Dockerfile for the FastAPI application.

- Uses `python:3.12-slim`.
- Sets Python and pip environment variables to reduce image noise and avoid bytecode files.
- Installs dependencies with `pip --no-cache-dir`.
- Creates and runs as a non-root user.
- Copies backend source code and shared checklist config required by the backend.
- Exposes port `8001`.
- Starts the app with `gunicorn` and `uvicorn.workers.UvicornWorker`, which is appropriate for FastAPI production serving on ECS Fargate.

### `backend/.dockerignore`
Backend-specific Docker ignore file. It excludes Python caches, test caches, coverage output, local environment files, uploaded user files, Git metadata, and tests from the backend image build context.

### `docker-compose.yml`
Production-style local test compose file.

Services:

- `mongo`: local MongoDB 7 database with a persistent named volume and health check.
- `backend`: FastAPI service built from `backend/Dockerfile`, configured through environment variables, listening on port `8001`.
- `frontend`: nginx-served React frontend built from `frontend/Dockerfile`, listening on host port `8080` and proxying same-origin API requests to the backend service.

The compose file uses Docker service names for internal networking and does not require application localhost URLs.

## Local testing with Docker

> Docker was not available in the original coding environment, so run these commands on a workstation or CI runner with Docker installed.

Build and start all services:

```bash
docker compose up --build
```

Open the frontend:

```text
http://127.0.0.1:8080
```

Check backend health through the backend port:

```bash
curl http://127.0.0.1:8001/health
```

Check frontend/nginx health:

```bash
curl http://127.0.0.1:8080/health
```

Stop services:

```bash
docker compose down
```

Remove local MongoDB data as well:

```bash
docker compose down -v
```

## ECS Fargate deployment notes

### Frontend container

Recommended settings:

- Container port: `80`
- Health check path: `/health`
- Runtime environment variables:
  - `REACT_APP_BACKEND_URL`: public backend base URL, for example an API ALB URL or custom domain. Leave empty only when nginx should proxy same-origin `/api` traffic.
  - `NGINX_API_PROXY`: internal backend URL for same-origin proxying, if used.

### Backend container

Recommended settings:

- Container port: `8001`
- Health check path: `/health`
- Required environment variables:
  - `MONGO_URL`
  - `DB_NAME`
  - `JWT_SECRET`
- Optional environment variables:
  - `APP_ENV`
  - `CORS_ORIGINS`
  - `JWT_ALGORITHM`
  - `JWT_EXPIRE_DAYS`
  - `PORT`
  - `WEB_CONCURRENCY`
  - `GUNICORN_TIMEOUT`
  - Provider-specific secrets such as Twilio or OpenAI/Emergent API keys when those features are enabled.

Store production secrets in AWS Secrets Manager or SSM Parameter Store and inject them into the ECS task definition as secrets rather than plaintext environment variables.

### Networking options

Common production layouts:

1. **Separate public frontend and backend load balancers or domains**
   - Set `REACT_APP_BACKEND_URL` to the backend public HTTPS origin.
   - Configure `CORS_ORIGINS` on the backend to the frontend HTTPS origin.

2. **Same-origin frontend with nginx API proxy**
   - Leave `REACT_APP_BACKEND_URL` empty.
   - Configure `NGINX_API_PROXY` to the backend service/load balancer origin.
   - Browser requests use `/api` and `/uploads` on the frontend origin.

In either layout, avoid placing database containers in ECS for production unless explicitly intended. For AWS production, prefer Amazon DocumentDB or a managed MongoDB-compatible provider, and configure `MONGO_URL` accordingly.
