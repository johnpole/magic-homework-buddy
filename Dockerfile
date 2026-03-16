# Stage 1: Build
FROM node:20 AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all files and build the project
COPY . .
RUN npm run build

# Stage 2: Serve
FROM node:20-slim

WORKDIR /app

# Copy the built application from the build stage
# Angular SSR puts the server in dist/app/server and browser in dist/app/browser
COPY --from=build /app/dist/app /app/dist/app
COPY --from=build /app/package*.json ./

# Install only production dependencies if needed, 
# although server.mjs is usually self-contained in modern Angular SSR.
RUN npm install --omit=dev

# The server listens on port 4000 by default in server.ts, 
# but Cloud Run expects it on the PORT env var.
ENV PORT=8080
EXPOSE 8080

# Start the SSR server
CMD ["node", "dist/app/server/server.mjs"]
