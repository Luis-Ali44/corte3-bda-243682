FROM node:20-alpine

WORKDIR /app

# Copiar dependencias primero (layer cache de Docker)
COPY package*.json ./
RUN npm install --production

# Copiar código fuente
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
