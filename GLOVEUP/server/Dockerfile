# Usamos una imagen de Node.js ligera (basada en Debian)
FROM node:20-slim

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las dependencias
RUN npm install --production

# Copiamos el resto del código del servidor
COPY . .

# Exponemos el puerto 3000
EXPOSE 3000

# Comando para arrancar la aplicación
# Usamos el flag --env-file para cargar variables si existen
CMD ["node", "src/index.js"]
