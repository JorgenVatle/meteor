import { type OnResolveResult, Plugin, type OnLoadResult } from 'esbuild';
import Path from 'node:path';
import { PACKAGE_DIST_DIR } from '../Config';
import { Logger } from '../lib/Logger';

export function meteor({ external = true } = {}): Plugin {
    return {
        name: 'meteor',
        setup(build) {
            
            // Todo: Update TSUp config to ensure Meteor isn't externalized - in turn rendering
            //  this plugin inaffective. Caused me some confusion when preparing packages.
            
            build.onResolve({ filter: /^meteor\// }, (args) => {
                const [meteor, name] = args.path.split('/');
                const result: OnResolveResult = {
                    path: Path.join(PACKAGE_DIST_DIR, name, 'server.mjs'),
                    external,
                    sideEffects: true,
                }
                
                Logger.debug({ meteor, name, result });
                return result;
            });
        }
    }
}