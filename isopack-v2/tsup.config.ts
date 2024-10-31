import { defineConfig } from 'tsup';
import { NO_EXTERNALIZE_NAMESPACES } from './src/Config';
import { meteor } from './src/plugin/EsbuildPluginMeteor';

export default defineConfig({
    entry: ['./src/main.ts'],
    outDir: './dist/src',
    skipNodeModulesBundle: true,
    clean: true,
    sourcemap: true,
    cjsInterop: true,
    shims: true,
    splitting: false,
    platform: 'node',
    target: 'node20',
    noExternal: NO_EXTERNALIZE_NAMESPACES,
    format: 'esm',
    esbuildPlugins: [
       meteor({ external: false }),
    ]
})