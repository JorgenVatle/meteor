import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export class Npm {
    public require(name: string) {
        return require(name);
    }
}

declare global {
    const globalThis: Record<string, any>;
}

globalThis.Npm = new Npm();