FROM node:22-alpine AS build

WORKDIR /app
ENV CI=true

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG REACT_APP_BACKEND_URL=
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}
RUN npm run build

FROM nginx:alpine

ENV REACT_APP_BACKEND_URL= \
    NGINX_API_PROXY=http://backend:8001

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/99-runtime-config.sh /docker-entrypoint.d/99-runtime-config.sh
COPY --from=build /app/build /usr/share/nginx/html

RUN chmod +x /docker-entrypoint.d/99-runtime-config.sh

EXPOSE 80
