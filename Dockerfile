FROM node:20-alpine

WORKDIR /app

# Install project dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Install Netlify CLI to run functions + frontend locally
RUN npm install -g netlify-cli

EXPOSE 8888

# Run Netlify Dev (serves Vite dev server + Netlify Functions)
CMD ["sh", "-c", "NETLIFY_DEV_HOST=0.0.0.0 netlify dev --port=8888"]
