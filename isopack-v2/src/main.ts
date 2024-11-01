import { spawnSync } from 'node:child_process';
import * as FS from 'node:fs';
import * as Path from 'node:path';
import * as process from 'node:process';
import { build } from 'tsup';
import {
    BUNDLE_ASSETS_DIR,
    DEBUG, NO_EXTERNALIZE_NAMESPACES,
    NPM_MASTER_MODULE,
    PACKAGE_DIST_DIR,
    PACKAGE_ENTRY_DIR,
    PACKAGE_ENTRY_EXT, PACKAGE_MASTER_MODULE,
    PACKAGE_NPM_DIR, PACKAGE_RUNTIME_ENVIRONMENT, PACKAGE_SRC_DIR,
    PACKAGE_TSCONFIG_FILE,
    PACKAGE_TYPES_DIR,
} from './Config';
import { moduleImport, moduleReExport, packagePath } from './lib/Helpers';
import { Logger } from './lib/Logger';
import { NpmDependencies, PackageCordova, PackageNamespace, PackageNpm, Packages, Scope } from './lib/Package';

const memoryModules = {
    meteorRuntime: '',
}

async function parse(packageName: string) {
    if (Packages.has(packageName)) {
        return;
    }
    
    globalThis.Package = new PackageNamespace(packageName);
    globalThis.Npm = new PackageNpm();
    globalThis.Cordova = new PackageCordova();
    
    await import(packagePath(packageName)).catch((error) => {
        Logger.warn(`Failed to load package: ${packageName}`);
        Logger.error(error);
    });
    
    for (const dependency of globalThis.Package.dependencies) {
        await parse(dependency);
    }
    
    return globalThis.Package;
}

async function compilePackages() {
    const [_node, _module, ...packages] = process.argv;
    
    if (!packages.length) {
        throw new Error('you need to specify a package name to compile');
    }
    
    for (const name of packages) {
        await parse(name);
    }
}

compilePackages().then(async () => {
    Logger.success(`Compilation completed - Parsed ${Packages.size} packages`);
    Logger.debugDir(Packages, { colors: true, depth: 3 });
    
    // Clean up entry modules from previous builds
    FS.rmSync(PACKAGE_ENTRY_DIR, { recursive: true, force: true });
    
    for (const [name, parsedPackage] of Packages) {
        await copyTypeDefinitions(parsedPackage);
    }
    
    await prepareEntryModules();
    await prepareGlobalExports();
    await prepareSingleBundleFile();
    console.dir(Packages.get('ddp-common'), { colors: true, depth: 3 });
    
    await build({
        name: 'built-packages',
        outDir: PACKAGE_DIST_DIR,
        clean: true,
        entry: [PACKAGE_MASTER_MODULE],
        
        sourcemap: true,
        splitting: false,
        shims: false,
        cjsInterop: false,
        target: 'node20',
        platform: 'node',
        format: 'esm',
        skipNodeModulesBundle: true,
        noExternal: NO_EXTERNALIZE_NAMESPACES,
        esbuildPlugins: [
            {
                name: 'meteor:packages',
                setup(build) {
                    build.onResolve({ filter: /^(meteor\/|meteor:\w+)/ }, (args) => {
                        const [_, packageName, ...path] = args.path.split('/');
                        const result = {
                            path: packageName,
                            namespace: 'meteor:package',
                            sideEffects: true,
                        }
                        // Skip virtual module when accessing Meteor package assets directly.
                        if (path.length) {
                            result.path = Path.join(PACKAGE_SRC_DIR, packageName, path.join('/').replace(/\.(js|mjs)$/, '') + '.js')
                            result.namespace = 'file';
                        }
                        if (args.path.includes('meteor:runtime')) {
                            result.namespace = 'meteor:runtime';
                        }
                        console.log(result);
                        return result;
                    });
                    build.onLoad({ filter: /.*/, namespace: 'meteor:package' }, (args) => {
                        const [name, ...path] = args.path.split('/');
                        const parsedPackage = Packages.get(name);
                        if (args.path.includes('\0')) {
                            return {
                                contents: parsedPackage?.entrypointRaw.get('server').join('\n') || '',
                            };
                        }
                        const contents = [
                            parsedPackage?.entrypointRaw.get('server'),
                            // `import * as s1 from 'meteor:package/${args.path}\0'`,
                            // `globalThis.Package[${JSON.stringify(name)}] = s1`,
                        ].flat().join('\n');
                        if (!contents) {
                            console.warn(`Failed to get contents for ${parsedPackage?.name}`);
                        }
                        
                        return {
                            contents,
                            loader: 'js',
                            resolveDir: parsedPackage?.entryDir,
                        }
                    })
                    build.onEnd((build) => {
                        build.outputFiles?.forEach((file) => {
                            const newContent = file.text.replace(/___\w+___\d? as /g, '');
                            file.contents = Uint8Array.from(Buffer.from(newContent));
                        })
                    })
                }
            }
        ],
        silent: !DEBUG,
        config: false,
        tsconfig: PACKAGE_TSCONFIG_FILE,
    })
    
    installNpmDependencies();
}).catch((error) => {
    Logger.error(error);
    process.exit(1);
});

function createNpmMasterModule() {
    const imports: string[] = [];
    const exports: string[] = [];
    let index = 0;
    
    for (const name of NpmDependencies.keys()) {
        const importKey = `npm${index++}`;
        imports.push(`import ${importKey} from ${JSON.stringify(name)}`);
        exports.push(`${JSON.stringify(name)}: ${importKey}`);
    }
    
    FS.mkdirSync(Path.dirname(NPM_MASTER_MODULE), { recursive: true });
    FS.writeFileSync(NPM_MASTER_MODULE, [
        imports.join('\n'),
        'export default {', exports.join(', \n'), '}',
    ].join('\n'))
}

async function copyTypeDefinitions(parsedPackage: PackageNamespace) {
    FS.mkdirSync(PACKAGE_TYPES_DIR, { recursive: true });
    
    for (const file of parsedPackage.types) {
        const from = Path.join(parsedPackage.srcDir, file);
        const to = Path.join(PACKAGE_TYPES_DIR, file);
        
        const content = FS.readFileSync(from);
        const declarationContent = [
            `declare module 'meteor/${parsedPackage.name}' {`,
                content,
            '}',
        ].join('\n');
        
        FS.writeFileSync(to, declarationContent);
        Logger.debug(`Copied type definition file: ${file}`)
    }
}

async function prepareEntryModules() {
    const content: string[] = [
        `export const Package = {}`,
        `Object.assign(globalThis, { Package })`,
    ];
    
    let count = 0;
    
    for (const [name, parsedPackage] of Packages) {
        parsedPackage.writeEntryModules();
        const id = `pi${count++}`
        const importString = moduleImport({ path: parsedPackage.entryFilePath('server'), id, });
        content.push(
            importString,
            `Package[${JSON.stringify(name)}] = ${id}`
        )
    }
    
    FS.mkdirSync(PACKAGE_ENTRY_DIR, { recursive: true })
    FS.writeFileSync(Path.join(PACKAGE_ENTRY_DIR, `server.${PACKAGE_ENTRY_EXT}`), content.join('\n'));
}
async function prepareGlobalExports() {
    const globalModuleContent: string[] = [
        moduleImport({
            path: Path.join(BUNDLE_ASSETS_DIR, 'PackageRuntime.ts'),
        }),
        'globalThis.Package = globalThis.Package || {}',
        'globalThis.meteorEnv = {}',
    ];
    
    function addGlobalScaffolding(packageNames: string[]) {
        const packageObjects = JSON.stringify(Object.fromEntries(packageNames.map((key) => [key, {}])));
        const exports = [...new Set<string>(
            packageNames.map((name) => {
                return Packages.get(name)!.globalVariables.entries.map(([scope, keys]) => keys);
            }).flat(2)
        )];
        const imports: string[] = packageNames.map((name, index) => moduleImport({
            path: Path.join(PACKAGE_ENTRY_DIR, name, 'server.mjs'),
            id: `i${index}`,
        }));
        
        // globalModuleContent.push(...imports);
        globalModuleContent.push(
            `Object.assign(globalThis.Package, ${packageObjects})`,
            ...exports.map((key) => `globalThis.${key} = globalThis.${key}`),
        )
    }
    
    addGlobalScaffolding([...Packages.keys()]);
    
    memoryModules.meteorRuntime = globalModuleContent.join('\n');
    
    FS.writeFileSync(PACKAGE_RUNTIME_ENVIRONMENT, memoryModules.meteorRuntime);
}

async function prepareSingleBundleFile() {
    const content: string[] = [];
    Packages.forEach((parsedPackage) => {
        content.push(moduleReExport({
            path: parsedPackage.entryFilePath('server'),
        }));
        // content.push(moduleReExport({
        //     path: parsedPackage.entryFilePath('client'),
        // }));
    })
    
    FS.writeFileSync(PACKAGE_MASTER_MODULE, content.join('\n'));
}

function installNpmDependencies() {
    const lockfilePath = Path.join(PACKAGE_NPM_DIR, 'package-lock.json');
    FS.mkdirSync(Path.dirname(lockfilePath), { recursive: true });
    let lockfile = '';
    
    if (FS.existsSync(lockfilePath)) {
        lockfile = FS.readFileSync(lockfilePath, 'utf8');
    } else {
        const { status } = spawnSync('npm', ['init', '-y'], {
            cwd: PACKAGE_NPM_DIR,
            stdio: 'inherit'
        });
        if (status) {
            throw new Error('Failed to prepare package.json for Meteor package dependencies!');
        }
    }
    
    const missingDependencies: string[] = [];
    
    for (const name of NpmDependencies.keys()) {
        if (lockfile.includes(JSON.stringify(name))) {
            continue;
        }
        missingDependencies.push(name);
    }
    
    if (!missingDependencies.length) {
        return;
    }
    
    Logger.warn('You are missing some npm dependencies required by Meteor');
    Logger.warn('We are now installing these dependencies for you. This might take a minute or two...');
    Logger.warn(missingDependencies.map((name) => ` | ${name}`).join('\n'));
    
    
    const { error, stderr, stdout } = spawnSync(`npm`, ['i', '--save', '--workspaces', 'false', ...missingDependencies], {
        cwd: PACKAGE_NPM_DIR,
        stdio: 'inherit',
    });
    
    if (stdout) {
        Logger.info(stdout);
    }
    
    if (stderr) {
        Logger.error(stderr);
    }
    
    if (error) {
        throw error;
    }
    
}

declare const globalThis: {
    Package: PackageNamespace;
    Npm: PackageNpm;
    Cordova: PackageCordova;
}