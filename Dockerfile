FROM node:18-alpine
WORKDIR /app

COPY meta-dstack/ ./meta-dstack
COPY VRFCoordinator* ./artifacts/
COPY tsconfig.json .
COPY package.json .
COPY tee.ts ./tee.ts
RUN npm install --include=dev
RUN npm run prepare
ENV NODE_ENV=production

CMD ["npx", "ts-node", "tee.ts"]