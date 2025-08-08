# Use Node.js 18 as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and pnpm-lock.yaml (if using pnpm)
COPY package.json pnpm-lock.yaml* ./

# Install pnpm globally
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install

# Copy the rest of the application code
COPY . .

# Install Angular CLI globally
RUN npm install -g @angular/cli

# Expose port 80 for standard HTTP
EXPOSE 80

# Command to start the development server on port 80
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "80", "--proxy-config", "proxy.conf.json"]
