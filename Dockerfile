# 1. Elegimos nuestra imagen base
FROM nginx:alpine

# 2. Configuración endurecida de Nginx (cabeceras de seguridad + bloqueo de dotfiles)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# 3. Eliminamos los archivos por defecto que trae Nginx para evitar conflictos
RUN rm -rf /usr/share/nginx/html/*

# 4. Copiamos el frontend a la carpeta pública de Nginx
#    (el .dockerignore evita copiar .git, Dockerfile, .vscode, etc.)
COPY . /usr/share/nginx/html/

# 5. Quitamos del web root la carpeta de configuración de Nginx (no debe servirse)
RUN rm -rf /usr/share/nginx/html/nginx

# 6. Exponemos el puerto 80 (el estándar de internet)
EXPOSE 80

# 7. Instrucción para mantener a Nginx ejecutándose en primer plano
CMD ["nginx", "-g", "daemon off;"]
