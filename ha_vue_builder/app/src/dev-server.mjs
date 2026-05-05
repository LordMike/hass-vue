import http from 'node:http';
import { renderHtml } from './status.mjs';

export function startDevServer(options, statusStore, logger) {
  if (!options.dev_server) {
    logger.info('dev server stopped', { enabled: false });
    return null;
  }

  const port = Number(process.env.HA_VUE_INGRESS_PORT || 8099);
  const server = http.createServer((req, res) => {
    if (req.url === '/status.json') {
      const body = JSON.stringify(statusStore.toJson(), null, 2);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(body);
      return;
    }
    if (req.url === '/' || req.url === '/status.html') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      });
      res.end(renderHtml(statusStore.toJson()));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>HA Vue Builder</title>
<h1>HA Vue Builder</h1>
<p>Static builds remain available under <code>/local/ha-vue</code>.</p>
<p>Vite HMR through Home Assistant Ingress is environment-dependent, so this endpoint exposes build status without changing the static output path.</p>
<p><a href="./status.json">status.json</a></p>`);
  });

  server.listen(port, () => {
    logger.info('dev server started', { port, mode: 'status-ingress-fallback' });
  });
  return server;
}
