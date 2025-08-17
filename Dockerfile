# ---------- Build stage ----------
    FROM node:18-alpine AS build

    # Set working directory
    WORKDIR /app
    
    # Install pnpm and Angular CLI globally
    RUN npm install -g pnpm @angular/cli
    
    # Copy dependency files first (for better caching)
    COPY package.json pnpm-lock.yaml* ./
    
    # Install dependencies
    RUN pnpm install --frozen-lockfile
    
    # Copy the rest of the app source code
    COPY . .
    
    # Build Angular app for production
    RUN ng build --configuration production
    
    # ---------- Serve stage ----------
    FROM nginx:alpine
    
    # Copy built Angular files into Nginx html directory
    COPY --from=build /app/dist/dvf-map/browser/ /usr/share/nginx/html
    
    # Replace default Nginx config if you need Angular routing support
    # (optional: create nginx.conf in your project root)
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    
    # Expose port 80
    EXPOSE 80
    
    # Start Nginx
    CMD ["nginx", "-g", "daemon off;"]
    