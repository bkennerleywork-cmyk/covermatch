# Development and test image. Stages are selected with `target` in docker-compose.yml.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY . .
ENV VITE_USE_POLLING=true
EXPOSE 5173 6006
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# Building this stage fails if linting, types or tests fail.
FROM deps AS test
COPY . .
RUN npm run lint && npm run typecheck && npm run test:run
