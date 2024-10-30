import { Plugin } from "esbuild";
import Path from 'node:path';
import { PACKAGE_DIST_DIR } from '../Config';

export function meteor(): Plugin {
    return {
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
}