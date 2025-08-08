# Docker Setup for Frontend-V1

This document explains how to run the Angular frontend application using Docker.

## Prerequisites

- Docker installed on your system

## Building and Running with Docker

1. **Build the Docker image:**
   ```bash
   docker build -t frontend-v1 .
   ```

2. **Run the container:**
   ```bash
   docker run -p 80:80 frontend-v1
   ```

3. **Access the application:**
   Open your browser and go to `http://localhost`

### Option 2: Using Docker Compose

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

2. **Run in detached mode:**
   ```bash
   docker-compose up -d --build
   ```

3. **Stop the services:**
   ```bash
   docker-compose down
   ```

## Configuration

### API URL Configuration

The application is configured to connect to the backend API. You may need to update the API URL in the environment files:

- **Development:** `src/environments/environment.ts`
- **Production:** `src/environments/environment.prod.ts`

### For Docker Network Communication

If you're running both frontend and backend in Docker containers, you might need to:

1. Create a Docker network:
   ```bash
   docker network create app-network
   ```

2. Run containers on the same network:
   ```bash
   docker run --network app-network -p 4200:4200 frontend-v1
   ```

3. Update the API URL to use the backend container name instead of localhost.

## Dockerfile Explanation

The Dockerfile:
1. Uses Node.js 18 Alpine as the base image
2. Installs pnpm package manager
3. Copies and installs dependencies
4. Builds the Angular application for production
5. Command to start the development server
CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--proxy-config", "proxy.conf.json"] 
6. Enables CORS for API communication

## Troubleshooting

### Port Already in Use
If port 4200 is already in use, you can map to a different port:
```bash
docker run -p 8080:4200 frontend-v1
```
Then access the app at `http://localhost:8080`

### API Connection Issues
- Ensure your backend is running and accessible
- Check the API URL in the environment files
- Verify CORS settings on your backend
- If using Docker networks, ensure containers can communicate

### Build Issues
- Make sure you have enough disk space
- Clear Docker cache if needed: `docker system prune`
- Check that all dependencies are properly installed

## Development vs Production

- The Docker build creates a production build of the Angular application
- For development, you might want to use volume mounting to enable hot reload
- The current setup serves static files, which is suitable for production deployment
