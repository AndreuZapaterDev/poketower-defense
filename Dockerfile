FROM node:22-alpine

WORKDIR /app

# Instala dependencias primero para aprovechar la caché de capas
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 9000

CMD ["npm", "run", "dev"]
