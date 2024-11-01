import { createRequire } from 'module';
const require = createRequire(import.meta.url);

class Npm {
    public require(name: string) {
        try {
            return require(name);
        } catch (error) {
            console.error(`MeteorPackageNpm Error: Cannot find npm module ${name}. Make sure you have it installed in your project.`)
            console.error(` L $ npm i ${name}`);
            throw error;
        }
    }
}

declare namespace globalThis {
    let Npm: Npm;
    let require: Npm['require'];
    function defineProxy(key: string): any;
}

globalThis.Npm = new Npm();
globalThis.require = globalThis.Npm.require;

globalThis.defineProxy = (key: string) => {
    return new Proxy(globalThis, {
        get(target, prop, receiver) {
            return Reflect.get(target, key, receiver);
        }
    })
}
