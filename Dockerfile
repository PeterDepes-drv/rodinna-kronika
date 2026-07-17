# 1. Fáza: Zostavenie aplikácie (Build Stage)
FROM node:20-alpine AS build
WORKDIR /app

# Skopírovanie definícií balíčkov a inštalácia závislostí
COPY package*.json ./
RUN npm ci

# Skopírovanie všetkých súborov a zostavenie produkčného buildu
COPY . .
RUN npm run build

# 2. Fáza: Servovanie cez Nginx (Production Stage)
FROM nginx:alpine

# Skopírovanie zostavených statických súborov do Nginx adresára
COPY --from=build /app/dist /usr/share/nginx/html

# Skopírovanie Nginx konfigurácie pre správne fungovanie SPA smerovania (Routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
