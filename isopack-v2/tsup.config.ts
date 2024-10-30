import { defineConfig } from 'tsup';
import Path from 'node:path';
import { PACKAGE_DIST_DIR } from './src/Config';

export default defineConfig({
    entry: ['./src/main.ts', 'test-app/app.ts'],
    skipNodeModulesBundle: true,
    clean: true,
    sourcemap: true,
    noExternal: ['meteor'],
    format: 'esm',
    esbuildPlugins: [
        {
            name: 'meteor',
            setup(build) {
                build.onResolve({ filter: /^meteor\// }, (args) => {
                    const [meteor, name] = args.path.split('/');
                    const result = {
                        path: Path.join(PACKAGE_DIST_DIR, name, 'server.js'),
                        external: true,
                    }
                    
                    console.log({ meteor, name, result });
                    return result;
                });
            }
        }
    ]
})