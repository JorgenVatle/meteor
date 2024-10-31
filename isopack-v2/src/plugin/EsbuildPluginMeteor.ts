import { type OnResolveResult, Plugin, type OnLoadResult } from 'esbuild';
import Path from 'node:path';
import { PACKAGE_DIST_DIR, PACKAGE_ENTRY_DIR, PACKAGE_SRC_DIR } from '../Config';
import { packageSrcDir } from '../lib/Helpers';
import { Logger } from '../lib/Logger';

export function meteor({ external = true } = {}): Plugin {
    return {
        name: 'meteor',
        setup(build) {
            
            // Todo: Update TSUp config to ensure Meteor isn't externalized - in turn rendering
            //  this plugin inaffective. Caused me some confusion when preparing packages.
            
            build.onResolve({ filter: /^meteor\// }, (args) => {
                const [meteor, name, ...rest] = args.path.split('/');
                const result: OnResolveResult = {
                    path: Path.join(PACKAGE_ENTRY_DIR, name, 'server.mjs'),
                    external,
                    sideEffects: true,
                }
                
                if (rest.length) {
                    result.path = Path.join(packageSrcDir(name), rest.join('/').replace(/\.(js|mjs)$/, '') + '.js');
                }
                
                Logger.debug({ meteor, name, result });
                return result;
            });
        }
    }
}