FROM node:20-alpine

WORKDIR /app

# Install project dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Install specific Netlify CLI version (pre-edge-fns issues on alpine/arm)
RUN npm install -g netlify-cli@17.36.2

# Install Deno (needed for Netlify edge runtime)
RUN apk add --no-cache curl && \
    curl -fsSL https://deno.land/install.sh | sh -s -- -A /usr/local && \
    ln -sf /usr/local/bin/deno /usr/bin/deno

EXPOSE 8888

# Run Netlify Dev (serves Vite dev server + Netlify Functions)
CMD ["sh", "-c", "NETLIFY_DEV_HOST=0.0.0.0 netlify dev --port=8888"]
