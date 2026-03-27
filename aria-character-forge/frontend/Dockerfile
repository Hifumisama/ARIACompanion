# Étape 1 : Construction (Build)
FROM node:20-alpine AS build

WORKDIR /app

# Installation des dépendances
COPY package*.json ./
RUN npm install

# Copie du code source et build
COPY . .

# Variables d'environnement injectées au build (via docker-compose build --build-arg ou .env)
ARG VITE_API_URL
ARG VITE_OLLAMA_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_OLLAMA_URL=${VITE_OLLAMA_URL}

RUN npm run build

# Étape 2 : Serveur de production
FROM nginx:stable-alpine

# Copie des fichiers buildés depuis l'étape précédente
COPY --from=build /app/dist /usr/share/nginx/html

# Configuration Nginx pour gérer le routage Single Page Application (SPA)
RUN echo "server { \
    listen 5174; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files \$uri \$uri/ /index.html; \
    } \
}" > /etc/nginx/conf.d/default.conf

EXPOSE 5174

CMD ["nginx", "-g", "daemon off;"]