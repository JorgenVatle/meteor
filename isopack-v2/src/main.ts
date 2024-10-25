import { build } from 'tsup';

declare const globalThis: {
    Package: any
}

async function parse(packageName: string) {
    globalThis.Package = {
        describe(config: { summary: string, version: string }) {
            console.log(config);
        },
        onUse() {
        
        }
    };
    
    await import(packagePath(packageName));
}

function packagePath(name: string) {
    return `../../../packages/${name}/package.js`;
}

async function compilePackages() {
    await parse('ddp');
}

compilePackages().then(() => {
    console.log('Finished')
}).catch((error) => {
    console.error(error);
});