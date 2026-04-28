# Usamos una imagen de Nginx ligera
FROM nginx:alpine

# Copiamos la configuración personalizada de Nginx
# La ruta es relativa al contexto de construcción (que será la raíz del proyecto)
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos todos los archivos estáticos al directorio de Nginx
COPY . /usr/share/nginx/html

# Exponemos el puerto 80
EXPOSE 80
