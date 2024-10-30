import { defineConfig } from 'tsup';
import { meteor } from './src/plugin/MeteorImports';

export default defineConfig({
    entry: ['./src/main.ts'],
    outDir: './dist/src',
    skipNodeModulesBundle: true,
    clean: true,
    sourcemap: true,
    noExternal: ['meteor'],
    format: 'esm',
    esbuildPlugins: [
       meteor(),
    ]
})