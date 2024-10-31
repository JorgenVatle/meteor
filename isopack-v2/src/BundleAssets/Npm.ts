import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export class Npm {
    public require(name: string) {
        return require(name);
    }
}