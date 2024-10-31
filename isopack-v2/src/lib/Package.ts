import Path from 'node:path';
import { PACKAGE_ENTRY_DIR } from '../Config';
import { normalizeOptionalArray, packagePath } from './Helpers';
import { Logger } from './Logger';

export const Packages = new Map<string, PackageNamespace>();
export const NpmDependencies = new Map<string, string>();

export class PackageNamespace {
    public readonly dependencies = new Set<string>();
    public readonly assets = new Set<ScopedReference>();
    public readonly entryModule = new Map<Scope, string>();
    public readonly impliedPackages = new Set<string>();
    public readonly modules = new Set<ScopedReference>();
    public readonly types = new Set<string>();
    public readonly entrypoint: Partial<Record<Scope | string, string[]>> = {};
    
    public pushToEntrypoint(scope: Scope | string, content: string[]) {
        const entrypoint = this.entrypoint[scope] = this.entrypoint[scope] || [];
        entrypoint.push(content.join('\n'));
    }
    
    public get srcDir() {
        return Path.dirname(packagePath(this.name));
    }
    
    public get entryDir() {
        return Path.join(PACKAGE_ENTRY_DIR, this.name);
    }
    
    // Defined in package.js with api.export()
    public readonly globalVariables = new Set<ScopedReference>();
    
    constructor(public readonly name: string) {
        Packages.set(name, this);
    }
    
    public describe(config: {
        summary: string,
        version: string;
    }) {
        const packageId = `${this.name}@${config.version}`.padEnd(32, ' ');
        Logger.info(`📦 ${packageId} ${config.summary}`);
    }
    
    public onUse(handler: (api: PackageNamespace) => void) {
        handler(this);
    }
    
    public use(packages: string[], contexts: ScopeOption) {
        if (!Array.isArray(packages)) {
            this.loadDependency(packages);
            return;
        }
        for (const packageName of packages) {
            this.loadDependency(packageName);
        }
    }
    
    protected loadDependency(packageName: string) {
        if (packageName.includes(':')) {
            Logger.warn(`Cannot load external dependency! ${packageName}`);
            return;
        }
        
        this.dependencies.add(packageName.split('@')[0]);
    }
    
    public addAssets(assets: string | string[], scope: Scope = 'common') {
        for (const asset of normalizeOptionalArray(assets)) {
            this.assets.add([scope, asset]);
            if (asset.endsWith('.d.ts')) {
                this.types.add(asset);
            }
        }
    }
    
    public addFiles(files: string | string[], scopeOption: ScopeOption = 'common') {
        for (const file of normalizeOptionalArray(files)) {
            for (const scope of normalizeOptionalArray(scopeOption)) {
                this.modules.add([scope, file]);
            }
        }
    }
    
    public imply(packageName: string) {
        this.impliedPackages.add(packageName);
    }
    
    public export(name: string, context: ScopeOption = 'common') {
        for (const scope of normalizeOptionalArray(context)) {
            this.globalVariables.add([scope, name]);
        }
    }
    
    public mainModule(path: string, scope: Scope = 'common') {
        this.entryModule.set(scope, path);
    }
    
    public onTest(handler: (api: PackageNamespace) => void) {
        // handler(this);
    }
    
    public registerBuildPlugin() {}
    
}


export class PackageNpm {
    public dependencies: Record<string, string> = {};
    depends(dependencies: Record<string, string>) {
        Object.entries(dependencies).forEach(([name, version]) => {
            this.dependencies[name] = version;
            NpmDependencies.set(name, version);
        })
    }
    strip() {
    
    }
}

export class PackageCordova extends PackageNpm {

}


export type Scope = 'server' | 'client' | 'common';
export type ScopeOption = Scope | Scope[];
export type ScopedReference = [Scope, string];
