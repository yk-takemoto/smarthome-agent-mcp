# Specify the base image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# If a self-signed certificate is required, place it in certs/ca.pem and uncomment the following lines
# COPY certs/ca.pem ./
# ENV NODE_EXTRA_CA_CERTS=/app/ca.pem

# Copy system definition files
COPY *.json ./
COPY *.mjs ./

# Install dependencies
RUN npm install

# Copy application source code and content
WORKDIR /app/src
COPY ./src .
WORKDIR /app/public
COPY ./public .
WORKDIR /app/audio
COPY ./audio .

# Copy application definition files
WORKDIR /app/funcdef
COPY ./funcdef .
WORKDIR /app
COPY devctl.yaml ./
COPY org.yaml ./
COPY user.production.yaml ./

# Build the application
WORKDIR /app
RUN npm run build

# Set environment variables
ENV NODE_ENV=production

# Specify the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
