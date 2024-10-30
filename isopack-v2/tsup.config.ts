import { defineConfig } from 'tsup';
import { meteor } from './src/plugin/EsbuildPluginMeteor';

export default defineConfig({
    entry: ['./src/main.ts'],
    outDir: './dist/src',
    skipNodeModulesBundle: true,
    clean: true,
    sourcemap: true,
    cjsInterop: false,
    noExternal: ['meteor'],
    format: 'esm',
    esbuildPlugins: [
       meteor(),
    ]
})