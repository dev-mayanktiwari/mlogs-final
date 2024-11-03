FROM node:alpine

WORKDIR /usr/src/mlogs-backend

COPY package.json package-lock.json ./

RUN echo "After COPY:" && pwd && ls -la

RUN npm i

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]