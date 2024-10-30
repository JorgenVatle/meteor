import { defineConfig } from 'tsup';
import tsupConfig from '../tsup.config';

export default defineConfig({
    ...tsupConfig,
    outDir: '../dist/test-app',
    entry: ['./app.ts'],
})