ARG BUILD_FROM=ghcr.io/home-assistant/base:3.21
ARG HASS_VERSION=local
FROM ${BUILD_FROM}

ARG HASS_VERSION
ENV HASS_VUE_VERSION=${HASS_VERSION}

LABEL \
  io.hass.version="${HASS_VERSION}" \
  io.hass.type="app" \
  io.hass.arch="aarch64|amd64"

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache nodejs npm

WORKDIR /app
COPY app/package.json app/package-lock.json* ./
RUN npm ci --ignore-scripts --omit=dev

COPY app/src ./src
COPY app/test ./test
COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 8099
CMD ["/run.sh"]
