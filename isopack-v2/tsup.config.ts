import { defineConfig } from 'tsup';
import Path from 'node:path';

export default defineConfig({
    entry: ['./src/main.ts', 'test-app/app.js'],
    skipNodeModulesBundle: true,
    sourcemap: true,
    noExternal: ['meteor'],
    esbuildPlugins: [
        {
            name: 'meteor',
            setup(build) {
                build.onResolve({ filter: /^meteor\// }, (args) => {
                    const [meteor, name] = args.path.split('/');
                    const result = {
                        path: Path.join(process.cwd(), '_packageDist', name, 'server'),
                        external: true,
                    }
                    
                    console.log({ meteor, name, result });
                    return result;
                });
            }
        }
    ]
})