import * as Path from 'node:path';
import * as process from 'node:process';
import { build } from 'tsup';
import * as FS from 'node:fs';


const packages = new Map<string, Package>();

class Package {
    public readonly dependencies = new Set<string>();
    public readonly assets = new Set<ScopedReference>();
    public readonly entryModule = new Map<Scope, string>();
    public readonly impliedPackages = new Set<string>();
    public readonly modules = new Set<ScopedReference>();
    
    // Defined in package.js with api.export()
    public readonly globalVariables = new Set<ScopedReference>();
    
    constructor(public readonly name: string) {
        packages.set(name, this);
    }
    
    public describe(config: {
        summary: string,
        version: string;
    }) {
        console.log(config);
    }
    
    public onUse(handler: (api: Package) => void) {
        handler(this);
    }
    
    public use(packages: string[], contexts: ScopeOption) {
        if (!Array.isArray(packages)) {
            this.loadDependency(packages);
            return;
        }
        for (const packageName of packages) {
            this.loadDependency(packageName);
        }
    }
    
    protected loadDependency(packageName: string) {
        if (packageName.includes(':')) {
            console.warn(`Cannot load external dependency! ${packageName}`);
            return;
        }
        
        this.dependencies.add(packageName.split('@')[0]);
    }
    
    public addAssets(assets: string | string[], scope: Scope = 'common') {
        for (const asset of normalizeOptionalArray(assets)) {
            this.assets.add([scope, asset]);
        }
    }
    
    public addFiles(files: string | string[], scopeOption: ScopeOption = 'common') {
        for (const file of normalizeOptionalArray(files)) {
            for (const scope of normalizeOptionalArray(scopeOption)) {
                this.modules.add([scope, file]);
            }
        }
    }
    
    public imply(packageName: string) {
        this.impliedPackages.add(packageName);
    }
    
    public export(name: string, context: ScopeOption = 'common') {
        for (const scope of normalizeOptionalArray(context)) {
            this.globalVariables.add([scope, name]);
        }
    }
    
    public mainModule(path: string, scope: Scope = 'common') {
        this.entryModule.set(scope, path);
    }
    
    public onTest(handler: (api: Package) => void) {
        // handler(this);
    }
    
    public registerBuildPlugin() {}
    
}

class Npm {
    public dependencies?: Record<string, string>;
    depends(dependencies: Record<string, string>) {
        this.dependencies = dependencies;
    }
    strip() {
    
    }
}

class Cordova extends Npm {

}

async function parse(packageName: string) {
    if (packages.has(packageName)) {
        return;
    }
    
    globalThis.Package = new Package(packageName);
    globalThis.Npm = new Npm();
    globalThis.Cordova = new Cordova();
    
    await import(packagePath(packageName)).catch((error) => {
        console.warn(`Failed to load package: ${packageName}`);
        console.error(error);
    });
    
    return globalThis.Package;
}

function packagePath(name: string) {
    return `${__dirname}/../../packages/${name}/package.js`;
}

async function compilePackages() {
    await parse('ddp');
    
    for (const dependency of globalThis.Package.dependencies) {
        await parse(dependency);
    }
}

compilePackages().then(async () => {
    console.log('Finished');
    console.dir(packages, { colors: true, depth: 3 });
    
    for (const [name, parsedPackage] of packages) {
        await prepareEntryModules(parsedPackage)
        await buildPackage(parsedPackage);
    }
}).catch((error) => {
    console.error(error);
});

const PACKAGE_ENTRY_DIR = Path.join(process.cwd(), '.package-entry');

async function buildPackage(parsedPackage: Package) {
    const name = parsedPackage.name;
    
    // todo: Prepare common, server and client entry files for package.
    await build({
        name: 'built-packages',
        outDir: `_packageDist/${name}`,
        clean: true,
        entry: [
            Path.join(PACKAGE_ENTRY_DIR, name, 'client.js'),
            Path.join(PACKAGE_ENTRY_DIR, name, 'server.js'),
            Path.join(PACKAGE_ENTRY_DIR, name, 'common.js'),
        ],
        define: {
            DDP: '{}',
            DDPServer: '{}',
        },
        splitting: false,
        target: 'node20',
        skipNodeModulesBundle: true,
        external: ['esbuild'],
        config: false,
    })
}

async function prepareEntryModules(parsedPackage: Package) {
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
    for (const [scope, path] of parsedPackage.entryModule) {
        scopes[scope].imports.push(path);
    }
    
    for (const [scope, path] of parsedPackage.modules) {
        scopes[scope].imports.push(path);
    }
    
    for (const [scope, id] of parsedPackage.globalVariables) {
        scopes[scope].exports.push(id)
    }
    
    Object.entries(scopes).forEach(([scope, data]) => {
        const entryFileDir = Path.join(PACKAGE_ENTRY_DIR, parsedPackage.name);
        const entryFilePath = Path.join(entryFileDir, `${scope}.js`);
        const packageDir = Path.join(process.cwd(), '..', 'packages', parsedPackage.name);
        const importStrings = data.imports.map((path) => {
            const absolutePath = Path.join(packageDir, path);
            const relativePath = Path.relative(entryFileDir, absolutePath)
            
            return `import ${JSON.stringify(relativePath)}`;
        });
        
        const exportStrings = data.exports.map((id) => `export const ${id} = globalThis.${id}`);
        
        if (scope !== 'common') {
            importStrings.unshift(`import ${JSON.stringify('./common')}`);
        }
        
        FS.mkdirSync(entryFileDir, { recursive: true });
        FS.writeFileSync(entryFilePath, [
            importStrings.join('\n'),
            exportStrings.join('\n'),
        ].join('\n'));
        console.log(`Created entry file: ${Path.relative(process.cwd(), entryFilePath)}`);
    });
}

declare const globalThis: {
    Package: Package;
    Npm: Npm;
    Cordova: Cordova;
}

function normalizeOptionalArray<TType extends string>(input: TType | TType[]): TType[] {
    if (Array.isArray(input)) {
        return input;
    }
    return [input];
}

type Scope = 'server' | 'client' | 'common';
type ScopeOption = Scope | Scope[];
type ScopedReference = [Scope, string];