import * as FS from 'node:fs';
import * as Path from 'node:path';
import * as process from 'node:process';
import { build } from 'tsup';
import { BUNDLE_ASSETS_DIR, DEBUG, PACKAGE_DIST_DIR, PACKAGE_ENTRY_DIR, TYPES_DIST_DIR } from './Config';
import { packagePath } from './lib/Helpers';
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
    FS.rmSync(PACKAGE_ENTRY_DIR, { recursive: true });
    
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
        splitting: true,
        cjsInterop: true,
        target: 'node20',
        format: 'esm',
        skipNodeModulesBundle: true,
        noExternal: ['meteor'],
        esbuildPlugins: [
            meteor(),
        ],
        silent: !DEBUG,
        config: false,
        tsconfig: 'tsconfig.packages.json',
    })
    
    Logger.log('Remember to install npm dependencies:\n', [...NpmDependencies.keys()].join(' '));
}).catch((error) => {
    Logger.error(error);
    process.exit(1);
});

async function copyTypeDefinitions(parsedPackage: PackageNamespace) {
    await FS.mkdirSync(TYPES_DIST_DIR, { recursive: true });
    
    for (const file of parsedPackage.types) {
        const from = Path.join(parsedPackage.srcDir, file);
        const to = Path.join(TYPES_DIST_DIR, file);
        
        const content = FS.readFileSync(from);
        const declarationContent = [
            `declare module 'meteor/${parsedPackage.name}' {`,
                content,
            '}',
        ].join('\n');
        
        await FS.writeFileSync(to, declarationContent);
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
        const packageDir = Path.join(process.cwd(), '..', 'packages', parsedPackage.name);
        const importStrings = data.imports.map((path) => {
            const absolutePath = Path.join(packageDir, path);
            const relativePath = Path.relative(entryFileDir, absolutePath)
            
            return `export * from ${JSON.stringify(relativePath)}`;
        });
        
        const exportStrings = data.exports.map((id) => `export const ${id} = globalThis.${id}`);
        
        if (scope !== 'common') {
            importStrings.unshift(`export * from ${JSON.stringify('./common')}`);
        }
        
        importStrings.unshift(`import ${JSON.stringify(Path.relative(entryFileDir, Path.join(BUNDLE_ASSETS_DIR, 'PackageRuntime')))}`);
        
        FS.mkdirSync(entryFileDir, { recursive: true });
        FS.writeFileSync(entryFilePath, [
            importStrings.join('\n'),
            exportStrings.join('\n'),
        ].join('\n'));
        Logger.debug(`Created entry file: ${Path.relative(process.cwd(), entryFilePath)}`);
    });
}

declare const globalThis: {
    Package: PackageNamespace;
    Npm: PackageNpm;
    Cordova: PackageCordova;
}