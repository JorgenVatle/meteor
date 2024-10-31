import * as FS from 'node:fs';
import * as Path from 'node:path';
import * as process from 'node:process';
import { spawnSync } from 'node:child_process';
import { build } from 'tsup';
import {
    BUNDLE_ASSETS_DIR,
    DEBUG, NPM_MASTER_MODULE,
    PACKAGE_DIST_DIR,
    PACKAGE_ENTRY_DIR, PACKAGE_ENTRY_EXT, PACKAGE_NPM_DIR,
    PACKAGE_SRC_DIR,
    PACKAGE_TSCONFIG_FILE,
    PACKAGE_TYPES_DIR, ROOT_DIR,
} from './Config';
import { moduleImport, moduleReExport, packagePath, packageSrcDir } from './lib/Helpers';
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
    
    await prepareGlobalExports();
    
    await build({
        name: 'built-packages',
        outDir: PACKAGE_DIST_DIR,
        clean: true,
        entry: [PACKAGE_ENTRY_DIR],
        
        sourcemap: true,
        splitting: false,
        cjsInterop: true,
        target: 'node20',
        platform: 'node',
        format: 'esm',
        skipNodeModulesBundle: true,
        noExternal: [/^meteor\//],
        esbuildPlugins: [
            meteor(),
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

async function prepareEntryModules(parsedPackage: PackageNamespace) {
    FS.mkdirSync(parsedPackage.entryDir, { recursive: true });
    
    Object.keys(parsedPackage.entrypoint).forEach((scope) => {
        const entryFilePath = Path.join(parsedPackage.entryDir, `${scope}.${PACKAGE_ENTRY_EXT}`);
        const importStrings = [...parsedPackage.entrypoint[scope] || []];
        
        Logger.debug({ [`${parsedPackage.name}.${scope}`]: importStrings })
        
        if (scope !== 'common') {
            importStrings.unshift(moduleReExport({
                path: `./common.js`,
                normalizeFileExtension: PACKAGE_ENTRY_EXT,
            }));
        }
        
        importStrings.push(moduleImport({
            path: Path.join(PACKAGE_ENTRY_DIR, 'globals.js'),
        }));
        
        FS.writeFileSync(entryFilePath, importStrings.join('\n'));
        
        Logger.debug(`Created entry file: ${Path.relative(process.cwd(), entryFilePath)}`);
    });
}

async function prepareGlobalExports() {
    let count = 0;
    const globalModuleContent: string[] = [
        moduleImport({
            path: Path.join(BUNDLE_ASSETS_DIR, 'PackageRuntime.ts'),
        })
    ];
    for (const [name, parsedPackage] of Packages) {
        const scopes: Partial<Record<Scope, string[]>> = {};
        for (const [scope, id] of parsedPackage.globalVariables) {
            const content = scopes[scope] = scopes[scope] || [];
            const importId = `m${count++}`;
            
            content.push(moduleImport({
                path: Path.join(PACKAGE_ENTRY_DIR, parsedPackage.name, `${scope}.${PACKAGE_ENTRY_EXT}`),
                id: importId,
            }));
            
            content.push(`globalThis.${id} = ${importId}['${id}']`);
        }
        const entries = Object.entries(scopes);
        if (!entries.length) {
            continue;
        }
        globalModuleContent.push(`// ${name}`)
        entries.forEach(([scope, content]) => {
            globalModuleContent.push(content.join('\n'));
        });
    }
    
    FS.writeFileSync(Path.join(PACKAGE_ENTRY_DIR, 'globals.js'), globalModuleContent.join('\n'));
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
    
    
    const { error, stderr, stdout } = spawnSync(`npm`, ['i', '--save', ...missingDependencies], {
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