# ── Dev stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ── Build stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=dev /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Prod stage ─────────────────────────────────────────────────────────────
FROM nginx:alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
