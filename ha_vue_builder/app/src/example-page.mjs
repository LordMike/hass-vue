import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export async function createExamplePage(paths, logger) {
  const dir = path.join(paths.pagesRoot, 'example');
  const templatePath = path.join(paths.appRoot, 'src/templates/example-index.vue');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.vue'), await readFile(templatePath, 'utf8'), { flag: 'wx' }).catch((error) => {
    if (error.code !== 'EEXIST') throw error;
  });
  await writeFile(path.join(dir, 'page.json'), JSON.stringify({
    title: 'HA Vue Builder',
    description: 'Example Home Assistant Vue page'
  }, null, 2), { flag: 'wx' }).catch((error) => {
    if (error.code !== 'EEXIST') throw error;
  });
  logger.info('example page created', { source: path.join(dir, 'index.vue') });
}
