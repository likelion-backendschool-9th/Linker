// Standalone browser fixture: imports real shared UI, never creates a Next/product route.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
// Vite is the existing Vitest engine; no second build tool/version is installed.
const engine = createRequire(require.resolve('vitest/config'));
const { createServer } = await import(pathToFileURL(engine.resolve('vite')).href);
const { default: react } = await import(
  pathToFileURL(require.resolve('@vitejs/plugin-react')).href
);
const root = fileURLToPath(new URL('.', import.meta.url));
const web = path.resolve(root, '../..');
const server = await createServer({
  configFile: false,
  root,
  plugins: [react()],
  resolve: { alias: { '@': path.join(web, 'src') } },
  server: {
    host: '127.0.0.1',
    port: 3101,
    strictPort: true,
    fs: { allow: [path.resolve(web, '../..')] },
  },
});
await server.listen();
server.printUrls();
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
