import * as FS from 'node:fs';
import * as Path from 'node:path';
import * as process from 'node:process';
import { build } from 'tsup';
import {
    BUNDLE_ASSETS_DIR,
    DEBUG, NPM_MASTER_MODULE,
    PACKAGE_DIST_DIR,
    PACKAGE_ENTRY_DIR, PACKAGE_SRC_DIR,
    PACKAGE_TSCONFIG_FILE,
    PACKAGE_TYPES_DIR,
} from './Config';
import { moduleImport, moduleReExport, packagePath } from './lib/Helpers';
import { Logger } from './lib/Logger';
import { meteor } from './plugin/EsbuildPluginMeteor';
import { PackageCordova, PackageNpm, PackageNamespace, Packages, Scope, NpmDependencies } from './lib/Package';

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
        await prepareEntryModules(parsedPackage)
        await copyTypeDefinitions(parsedPackage);
    }
    
    await build({
        name: 'built-packages',
        outDir: PACKAGE_DIST_DIR,
        clean: true,
        entry: [PACKAGE_ENTRY_DIR],
        
        sourcemap: true,
        splitting: false,
        cjsInterop: false,
        target: 'node20',
        platform: 'node',
        format: 'esm',
        skipNodeModulesBundle: true,
        noExternal: ['meteor'],
        esbuildPlugins: [
            meteor(),
        ],
        silent: !DEBUG,
        config: false,
        tsconfig: PACKAGE_TSCONFIG_FILE,
    })
    
    Logger.log('Remember to install npm dependencies:\n', [...NpmDependencies.keys()].join(' '));
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

async function prepareEntryModules(parsedPackage: PackageNamespace) {
    const scopes: Record<Scope, { imports: string[], exports: string[] }> = {
        server: {
            imports: [],
            exports: [],
        },
        client: {
            imports: [],
            exports: [],
        },
        common: {
            imports: [],
            exports: [],
        },
    };
    const prepareScope = (scope: Scope) => {
        if (scopes[scope]) {
            return;
        }
        scopes[scope] = {
            imports: [],
            exports: []
        }
    }
    for (const [scope, path] of parsedPackage.entryModule) {
        prepareScope(scope);
        scopes[scope].imports.push(path);
    }
    
    for (const [scope, path] of parsedPackage.modules) {
        prepareScope(scope);
        scopes[scope].imports.push(path);
    }
    
    for (const [scope, id] of parsedPackage.globalVariables) {
        prepareScope(scope);
        scopes[scope].exports.push(id)
    }
    
    Object.entries(scopes).forEach(([scope, data]) => {
        const entryFileDir = Path.join(PACKAGE_ENTRY_DIR, parsedPackage.name);
        const entryFilePath = Path.join(entryFileDir, `${scope}.js`);
        const globalsFilePath = Path.join(entryFileDir, `${scope}.globals.js`);
        
        const importStrings = data.imports.map((path) => moduleReExport({
            path: Path.join(PACKAGE_SRC_DIR, parsedPackage.name, path),
            fromDir: entryFileDir,
        }));
        
        const exportStrings: string[] = [];
        const globalStrings: string[] = [];
        
        data.exports.forEach((id) => {
            globalStrings.push(`globalThis.${id} = globalThis.${id}`);
            exportStrings.push(`export const ${id} = globalThis.${id}`);
        });
        
        if (scope !== 'common') {
            importStrings.unshift(moduleReExport({
                path: './common.js'
            }));
        }
        
        importStrings.unshift(moduleImport({
            path: Path.join(BUNDLE_ASSETS_DIR, 'PackageRuntime'),
            fromDir: entryFileDir
        }));
        
        importStrings.unshift(moduleImport({
            path: globalsFilePath,
            fromDir: entryFileDir,
        }));
        
        FS.mkdirSync(entryFileDir, { recursive: true });
        FS.writeFileSync(entryFilePath, [
            importStrings.join('\n'),
            exportStrings.join('\n'),
        ].join('\n'));
        
        FS.writeFileSync(globalsFilePath, globalStrings.join('\n'));
        Logger.debug(`Created entry file: ${Path.relative(process.cwd(), entryFilePath)}`);
    });
}

declare const globalThis: {
    Package: PackageNamespace;
    Npm: PackageNpm;
    Cordova: PackageCordova;
}