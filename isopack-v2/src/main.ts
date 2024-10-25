import { build } from 'tsup';

declare const globalThis: {
    Package: any
}

type PackageScope = 'server' | 'client';
type ScopeOption = PackageScope | PackageScope[];
const packages = new Set<Package>();

class Package {
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
    
    public use(packages: string[], contexts: ScopeOption) {
    
    }
    
    public addAssets(assets: string | string[]) {
    
    }
    
    public imply(packageName: string) {
    
    }
    
    public export(name: string, context: ScopeOption) {
    
    }
}



async function parse(packageName: string) {
    globalThis.Package = new Package(packageName);
    
    await import(packagePath(packageName));
}

function packagePath(name: string) {
    return `${__dirname}/../../packages/${name}/package.js`;
}

async function compilePackages() {
    await parse('ddp');
}

compilePackages().then(() => {
    console.log('Finished')
}).catch((error) => {
    console.error(error);
});