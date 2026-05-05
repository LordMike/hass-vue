import { APP_ID, APP_VERSION } from './constants.mjs';
import { loadConfig } from './config.mjs';
import { createLogger } from './logger.mjs';
import { validatePaths } from './paths.mjs';
import { StatusStore } from './status.mjs';
import { startDevServer } from './dev-server.mjs';
import { PageWatcher } from './watcher.mjs';

const options = await loadConfig();
const logger = createLogger(options.log_level);
logger.info('startup', { app: APP_ID, version: APP_VERSION });
logger.info('config loaded', {
  dev_server: options.dev_server,
  log_level: options.log_level,
  create_example: options.create_example
});

const paths = await validatePaths(logger);
const statusStore = new StatusStore(paths, options);
const devServer = startDevServer(options, statusStore, logger);
const pageWatcher = new PageWatcher(paths, options, logger, statusStore);

await pageWatcher.initialBuild();
const fsWatcher = pageWatcher.start();

async function shutdown() {
  logger.info('shutdown started');
  await fsWatcher.close();
  if (devServer) devServer.close();
  logger.info('shutdown complete');
}

process.on('SIGTERM', () => shutdown().then(() => process.exit(0)));
process.on('SIGINT', () => shutdown().then(() => process.exit(0)));
