import { createRequire } from 'module';
const require = createRequire(import.meta.url);

class Npm {
    public require(name: string) {
        try {
            return require(name);
        } catch (error) {
            console.error(`Could not require() package "${name}"`)
            throw error;
        }
    }
}

declare namespace globalThis {
    let Npm: Npm;
    let require: Npm['require'];
}

globalThis.Npm = new Npm();
globalThis.require = globalThis.Npm.require;