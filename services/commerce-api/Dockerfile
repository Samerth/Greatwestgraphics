# Build from the repository root:
# docker build -f services/commerce-api/Dockerfile -t gwg-commerce-api .
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY services/commerce-api/package.json services/commerce-api/package.json
RUN npm ci

COPY packages/contracts packages/contracts
COPY services/commerce-api services/commerce-api
RUN npm run build --workspace @gwg/commerce-api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    COMMERCE_API_HOST=0.0.0.0 \
    COMMERCE_API_PORT=4000
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY services/commerce-api/package.json services/commerce-api/package.json
RUN npm ci --omit=dev --workspace @gwg/contracts --workspace @gwg/commerce-api --include-workspace-root=false \
    && npm cache clean --force

COPY --from=build --chown=node:node /app/packages/contracts/dist packages/contracts/dist
COPY --from=build --chown=node:node /app/services/commerce-api/dist services/commerce-api/dist

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "services/commerce-api/dist/server.js"]
