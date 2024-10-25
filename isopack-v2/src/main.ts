import { build } from 'tsup';


const packages = new Set<Package>();

class Package {
    public readonly dependencies = new Set<Package>();
    
    constructor(public readonly name: string) {
        packages.add(this);
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
        }
        for (const packageName of packages) {
            await parse(packageName);
        }
    }
    
    public addAssets(assets: string | string[]) {
    
    }
    
    public imply(packageName: string) {
    
    }
    
    public export(name: string, context: ScopeOption) {
    
    }
    
    public mainModule(path: string) {
    
    }
    
}

class Npm {
    public dependencies?: Record<string, string>;
    depends(dependencies: Record<string, string>) {
        this.dependencies = dependencies;
    }
}

async function parse(packageName: string) {
    globalThis.Package = new Package(packageName);
    globalThis.Npm = new Npm();
    
    await import(packagePath(packageName));
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