import * as Path from 'node:path';
import * as process from 'node:process';
import { build } from 'tsup';


const packages = new Map<string, Package>();

class Package {
    public readonly dependencies = new Set<string>();
    public readonly assets = new Set<ScopedReference>();
    public readonly entryModule = new Map<Scope, string>();
    public readonly impliedPackages = new Set<string>();
    public readonly modules = new Set<ScopedReference>();
    public readonly exports = new Set<ScopedReference>();
    
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
            this.exports.add([scope, name]);
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
}).catch((error) => {
    console.error(error);
});

async function buildPackage(name: string) {
    // todo: Prepare common, server and client entry files for package.
    await build({
        name: 'built-packages',
        outDir: '_packageDist',
        clean: true,
        entry: [
            Path.join(process.cwd(), '.package-entry', name, 'client.js'),
            Path.join(process.cwd(), '.package-entry', name, 'server.js'),
            Path.join(process.cwd(), '.package-entry', name, 'common.js'),
        ],
        splitting: false,
        target: 'node20',
        skipNodeModulesBundle: true,
        external: ['esbuild'],
        config: false,
    })
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