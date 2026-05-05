ARG BUILD_FROM=ghcr.io/home-assistant/base:3.21
FROM ${BUILD_FROM}

LABEL \
  io.hass.version="0.1.0" \
  io.hass.type="app" \
  io.hass.arch="aarch64|amd64"

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache nodejs npm

WORKDIR /app
COPY app/package.json app/package-lock.json* ./
RUN npm ci --ignore-scripts --omit=dev

COPY app/src ./src
COPY app/test ./test
COPY addon/run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 8099
CMD ["/run.sh"]
