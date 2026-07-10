# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
COPY backend/tsconfig*.json ./
COPY backend/nest-cli.json ./
COPY backend/src ./src

# Generate Prisma Client and compile NestJS
RUN npx prisma generate
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy build artifacts and generated Prisma Client code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/main"]
