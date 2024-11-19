FROM node:16-alpine

WORKDIR /app

COPY package*.json .

RUN npm install -g node-gyp

RUN npm install --force

COPY . .

EXPOSE 4007

CMD ["npm", "run", "build"]