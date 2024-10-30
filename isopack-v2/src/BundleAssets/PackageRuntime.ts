import { Npm } from './Npm';

declare global {
    const globalThis: Record<string, any>;
}

globalThis.Npm = new Npm();