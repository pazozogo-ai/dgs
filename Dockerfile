FROM node:20-bullseye-slim

WORKDIR /app

# Install base deps
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip && rm -rf /var/lib/apt/lists/*

# Install project dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Install specific Netlify CLI version (pre-edge-fns issues)
RUN npm install -g netlify-cli@17.36.2

# Install Deno (needed for Netlify edge runtime)
RUN curl -fsSL https://github.com/denoland/deno/releases/download/v2.4.2/deno-aarch64-unknown-linux-gnu.zip -o /tmp/deno.zip && \
    unzip /tmp/deno.zip -d /usr/local/bin && \
    chmod +x /usr/local/bin/deno && \
    ln -sf /usr/local/bin/deno /usr/bin/deno && \
    rm /tmp/deno.zip

EXPOSE 8888

# Run Netlify Dev (serves Vite dev server + Netlify Functions)
CMD ["sh", "-c", "NETLIFY_DEV_HOST=0.0.0.0 netlify dev --port=8888"]
