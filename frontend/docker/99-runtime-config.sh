#!/bin/sh
set -eu

cat > /usr/share/nginx/html/env-config.js <<EOF_CONFIG
window.__APP_CONFIG__ = {
  REACT_APP_BACKEND_URL: "${REACT_APP_BACKEND_URL}"
};
EOF_CONFIG
