# 1. Elegimos nuestra imagen base
FROM nginx:alpine

# 2. Copiamos la plantilla de Nginx para sustitución automática de $PORT en Railway/Docker
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# 3. Puerto por defecto (reemplazado por el $PORT dinámico asignado por Railway)
ENV PORT=80

# 4. Eliminamos los archivos por defecto que trae Nginx
RUN rm -rf /usr/share/nginx/html/*

# 5. Copiamos el frontend a la carpeta pública de Nginx
COPY . /usr/share/nginx/html/

# 6. Quitamos del web root la carpeta de configuración de Nginx
RUN rm -rf /usr/share/nginx/html/nginx

# 7. Exponemos el puerto
EXPOSE 80

# 8. Mantener a Nginx ejecutándose en primer plano
CMD ["nginx", "-g", "daemon off;"]
