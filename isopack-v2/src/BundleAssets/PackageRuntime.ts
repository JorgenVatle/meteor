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
    let global: any;
}

globalThis.Npm = new Npm();
globalThis.require = globalThis.Npm.require;
globalThis.global = new Proxy(globalThis, {
    get(target, prop, receiver) {
        if (prop === 'global') {
            return global;
        }
        return Reflect.get(target, prop, receiver);
    }
});

export const global = globalThis.global;