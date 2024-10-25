import { build } from 'tsup';

declare const globalThis: {
    Package: any
}

class Package {
    public describe(config: {
        summary: string,
        version: string;
    }) {
        console.log(config);
    }
    
    public onUse(handler: (api: Package) => void) {
        handler(this);
    }
}



async function parse(packageName: string) {
    globalThis.Package = new Package();
    
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