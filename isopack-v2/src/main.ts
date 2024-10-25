import { build } from 'tsup';


const packages = new Map<string, Package>();

class Package {
    public readonly dependencies = new Set<Package>();
    
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
    
    public async use(packages: string[], contexts: ScopeOption) {
        if (!Array.isArray(packages)) {
            await parse(packages);
            return;
        }
        for (const packageName of packages) {
            await parse(packageName);
        }
    }
    
    public addAssets(assets: string | string[]) {
    
    }
    
    public addFiles(files: string) {
    
    }
    
    public imply(packageName: string) {
    
    
    }
    
    public export(name: string, context: ScopeOption) {
    
    }
    
    public mainModule(path: string) {
    
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

async function parse(packageName: string) {
    if (packages.has(packageName)) {
        return;
    }
    globalThis.Package = new Package(packageName);
    globalThis.Npm = new Npm();
    
    await import(packagePath(packageName)).catch((error) => {
        console.warn(`Failed to load package: ${packageName}`);
        console.error(error);
    });
}

function packagePath(name: string) {
    return `${__dirname}/../../packages/${name}/package.js`;
}

async function compilePackages() {
    await parse('ddp');
}

compilePackages().then(() => {
    console.log('Finished');
    console.log(packages);
}).catch((error) => {
    console.error(error);
});

declare const globalThis: {
    Package: Package;
    Npm: Npm;
}

type PackageScope = 'server' | 'client';
type ScopeOption = PackageScope | PackageScope[];