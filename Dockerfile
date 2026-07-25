ARG BUILD_FROM=ghcr.io/home-assistant/base:3.21
FROM ${BUILD_FROM}

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache nodejs npm

WORKDIR /app
COPY app/package.json app/package-lock.json* ./
RUN npm ci --ignore-scripts --omit=dev

ARG BUILD_VERSION=local
ENV HASS_VUE_VERSION=${BUILD_VERSION}

LABEL \
  io.hass.version="${BUILD_VERSION}" \
  io.hass.type="app" \
  io.hass.arch="aarch64|amd64"

COPY app/src ./src
COPY app/test ./test
COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 8099
CMD ["/run.sh"]
