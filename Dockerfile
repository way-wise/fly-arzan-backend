# Official Node image
FROM node:lts

WORKDIR /app

# Copy only dependency files first (better caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy rest of the source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Start app
CMD ["npm", "run", "start"]
