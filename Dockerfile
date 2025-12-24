# Use Debian-based Node image (Prisma has issues with Alpine/musl)
FROM node:20-slim

WORKDIR /app

# Install OpenSSL (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy only dependency files first (better caching)
COPY package.json package-lock.json ./

# Copy Prisma schema before installing dependencies (needed for postinstall)
COPY prisma ./prisma

# Install dependencies (postinstall will run prisma generate)
RUN npm ci --legacy-peer-deps

# Copy rest of the source
COPY . .

# Build TypeScript
RUN npm run build

# Start app
CMD ["npm", "run", "start"]
