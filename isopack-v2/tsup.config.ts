import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['./src/main.ts'],
    skipNodeModulesBundle: true,
})