# ── Imagen base ──────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Eliminar configuración por defecto de nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar configuración personalizada
COPY nginx.conf /etc/nginx/conf.d/zenta.conf

# Copiar archivos HTML estáticos y estilos
COPY index.html    /usr/share/nginx/html/
COPY intranet.html /usr/share/nginx/html/
COPY css/          /usr/share/nginx/html/css/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
