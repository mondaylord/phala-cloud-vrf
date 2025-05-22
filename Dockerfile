FROM node:18-alpine
WORKDIR /app

COPY meta-dstack/ ./meta-dstack
COPY ./artifacts ./artifacts/
COPY tsconfig.json .
COPY package.json .
COPY tee.ts ./tee.ts
RUN npm install --include=dev
RUN npm run prepare
ENV NODE_ENV=production
EXPOSE 3000/tcp

ENTRYPOINT ["npx", "ts-node", "tee.ts"]