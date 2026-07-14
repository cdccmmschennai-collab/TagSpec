# TagSpec frontend — Vite build served by nginx, which also reverse-proxies the API.
# Build context: ./frontend

# ---- Stage 1: build the static bundle ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Empty API URL => the client calls same-origin "/api/v1", which nginx proxies
# to the backend. Override at build time for a split-host deployment.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- Stage 2: serve with nginx ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
