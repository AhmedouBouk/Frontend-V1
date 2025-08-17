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
