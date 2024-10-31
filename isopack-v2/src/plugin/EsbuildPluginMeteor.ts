import { type OnResolveResult, Plugin, type OnLoadResult } from 'esbuild';
import Path from 'node:path';
import { PACKAGE_DIST_DIR, PACKAGE_ENTRY_DIR, PACKAGE_TEMP_ENTRY_DIR } from '../Config';
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
                    path: Path.join(PACKAGE_TEMP_ENTRY_DIR, name, 'server.mjs'),
                    external,
                    sideEffects: true,
                }
                
                Logger.debug({ meteor, name, result });
                return result;
            });
        }
    }
}

//
// export function meteor({ external = true } = {}): Plugin {
//     return {
//         name: 'meteor',
//         setup(build) {
//
//             // Todo: Update TSUp config to ensure Meteor isn't externalized - in turn rendering
//             //  this plugin inaffective. Caused me some confusion when preparing packages.
//
//             build.onResolve({ filter: /^meteor\// }, (args) => {
//                 const [meteor, name] = args.path.split('/');
//                 const result: OnResolveResult = {
//                     // external,
//                     path: name,
//                     sideEffects: true,
//                     namespace: 'meteor',
//                 }
//
//                 Logger.debug({ meteor, name, result });
//                 return result;
//             });
//
//             build.onLoad({ namespace: 'meteor', filter: /.*/ }, (args) => {
//                 return {
//                     loader: 'js',
//                     contents: [
//                         `// Todo: load global context`,
//                         `export * from ${JSON.stringify(Path.join(PACKAGE_TEMP_ENTRY_DIR, args.path, 'common.mjs'))}`,
//                         `export * from ${JSON.stringify(Path.join(PACKAGE_TEMP_ENTRY_DIR, args.path, 'server.mjs'))}`,
//                     ].join('\n'),
//                     resolveDir: '/'
//                 }
//             })
//         }
//     }
// }