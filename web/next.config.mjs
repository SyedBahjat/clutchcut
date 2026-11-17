import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..'); // the API routes use ../desktop/engine.js

export default {
  outputFileTracingRoot: repo,
  turbopack: { root: repo },
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: { '/api/**/*': ['./node_modules/ffmpeg-static/ffmpeg'] },
};
