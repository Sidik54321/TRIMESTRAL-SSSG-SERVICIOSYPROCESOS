FROM node:20-slim

WORKDIR /app

# Instalar dependencias primero (capa cacheada si package.json no cambia)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar el código fuente
COPY . .

EXPOSE 3000

CMD ["node", "src/index.js"]
