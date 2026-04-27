# Usamos una imagen de Nginx ligera
FROM nginx:alpine

# Copiamos la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos todos los archivos estáticos al directorio de Nginx
COPY . /usr/share/nginx/html

# Exponemos el puerto 80
EXPOSE 80
