FROM node:14-alpine

WORKDIR /home
COPY package.json package.json
COPY cipher.js cipher.js
COPY index.mjs index.mjs
RUN npm install
CMD [ "node", "." ] 