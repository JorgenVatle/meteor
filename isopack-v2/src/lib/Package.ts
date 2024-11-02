import FS from 'node:fs';
import Path from 'node:path';
import { build } from 'tsup';
import {
    NO_EXTERNALIZE_NAMESPACES,
    PACKAGE_ENTRY_DIR,
    PACKAGE_ENTRY_EXT,
    PACKAGE_PRE_BUNDLE_IN,
    PACKAGE_PRE_BUNDLE_OUT, PACKAGE_RUNTIME_ENVIRONMENT,
    PACKAGE_TSCONFIG_FILE,
} from '../Config';
import { moduleImport, moduleReExport, moduleRequire, normalizeOptionalArray, packagePath } from './Helpers';
import { Logger } from './Logger';
import { ScopedRecord } from './ScopedRecord';

export const Packages = new Map<string, PackageNamespace>();
export const NpmDependencies = new Map<string, string>();

export class PackageNamespace {
    public readonly dependencies = new Set<string>();
    public readonly assets = new Set<ScopedReference>();
    public readonly entryModule = new Map<Scope, string>();
    public readonly impliedPackages = new Set<string>();
    public readonly modules = new Set<ScopedReference>();
    public readonly types = new Set<string>();
    // Defined in package.js with api.export()
    public readonly globalVariables = new ScopedRecord();
    public readonly entrypoint: Partial<EntrypointRecord> = {
        client: [],
        common: [],
        server: [],
    };
    public readonly base: Partial<EntrypointRecord> = {
        client: [],
        common: [],
        server: [],
    };
    public readonly entrypointRaw = new ScopedRecord();
    protected moduleIndex = 0;
    protected get globalKey() {
        return `globalThis.Package[${JSON.stringify(this.name)}]`;
    }
    protected createModuleId(index?: number) {
        return `m_${index ?? this.moduleIndex++}`
    }
    
    public pushToEntrypoint(scope: Scope | string, content: string[]) {
        const entrypoint = this.entrypoint[scope] = this.entrypoint[scope] || [];
        entrypoint.push(content.join('\n'));
    }
    
    public writeEntryModules() {
        for (const scope of ['client', 'server']) {
            const filePath = this.entryFilePath(scope);
            const content = this.entrypointRaw.get(scope);
            
            content.push(moduleImport({
                path: PACKAGE_RUNTIME_ENVIRONMENT,
            }))
            
            const bundleId = `pkg_${scope}`;
            content.push(moduleImport({
                path: this.preBundleFilePathOut(scope),
                id: `pkg_${scope}`,
            }));
            
            content.push('globalThis.Package = globalThis.Package || {}');
            content.push(`${this.globalKey} = ${bundleId}`);
            
            [
                ...this.globalVariables.get(scope as Scope),
                ...this.globalVariables.get('common'),
            ].forEach((id) => {
                if (id === 'Random') {
                    content.push('console.log(this)');
                    return;
                }
                content.push(
                    `export const ${id} = ${id} ?? ${bundleId}?.${id} ?? ${this.globalKey}?.${id}`,
                );
            });
            
            FS.mkdirSync(Path.dirname(filePath), { recursive: true });
            FS.writeFileSync(filePath, content.flat().join('\n'));
        }
    }
    
    public bundleMeteorAssets() {
        FS.mkdirSync(Path.join(PACKAGE_PRE_BUNDLE_IN, this.name), { recursive: true });
        Object.entries(this.base).forEach(([scope, files]) => {
            const globalsPath = this.preBundleFilePathIn(`${scope}.globals`);
            const globalsList = this.globalVariables.get(scope).map((key) => `globalThis.${key} = globalThis.${key}`);
            const list = [
                moduleRequire({ path: globalsPath }),
                files
            ];
            if (scope !== 'common') {
                list.push(this.base.common)
                globalsList.push(moduleRequire({
                    path: this.preBundleFilePathIn(`common.globals`),
                }));
            }
            
            FS.writeFileSync(globalsPath, globalsList.flat().join('\n'));
            FS.writeFileSync(this.preBundleFilePathIn(scope), list.flat().join('\n') || '');
        });
    }
    
    public static async bundleMeteorAssets() {
        await build({
            entry: [PACKAGE_PRE_BUNDLE_IN],
            outDir: PACKAGE_PRE_BUNDLE_OUT,
            shims: false,
            format: 'cjs',
            cjsInterop: true,
            silent: true,
            skipNodeModulesBundle: true,
            tsconfig: PACKAGE_TSCONFIG_FILE,
            config: false,
            noExternal: NO_EXTERNALIZE_NAMESPACES,
            esbuildPlugins: [
                {
                    name: 'meteor-server',
                    setup(build) {
                        build.onResolve({ filter: /^meteor\// }, (args) => {
                            const [_, name, ...parts] = args.path.split('/');
                            return {
                                path: Path.join(PACKAGE_PRE_BUNDLE_OUT, name, 'server.js'),
                                external: true,
                            }
                        })
                    }
                }
            ]
        })
    }
    
    public get srcDir() {
        return Path.dirname(packagePath(this.name));
    }
    
    public get entryDir() {
        return Path.join(PACKAGE_ENTRY_DIR, this.name);
    }
    
    public entryFilePath(scope: Scope | string) {
        return Path.join(this.entryDir, `${scope}.${PACKAGE_ENTRY_EXT}`);
    }
    
    public preBundleFilePathIn(scope: Scope | string) {
        return Path.join(PACKAGE_PRE_BUNDLE_IN, this.name, `${scope}.${PACKAGE_ENTRY_EXT}`);
    }
    
    public preBundleFilePathOut(scope: Scope | string) {
        return Path.join(PACKAGE_PRE_BUNDLE_OUT, this.name, `${scope}.js`);
    }
    
    constructor(public readonly name: string) {
        if (name.includes('@')) {
            console.log({ name });
            this.name = name.split('@')[0]
        }
        Packages.set(this.name, this);
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
        
        const name = packageName.split('@')[0];
        this.dependencies.add(name);
        this.base.common?.push(`require("meteor/${name}")`);
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
                const path = Path.join(this.srcDir, file)
                const id = this.createModuleId();
                this.pushToEntrypoint(scope, [
                    moduleImport({ path, id }),
                ]);
                (this.base[scope] || []).push(`require(${JSON.stringify(path)})`)
            }
        }
    }
    
    public imply(packageName: string) {
        this.impliedPackages.add(packageName);
    }
    
    public export(name: string | string[], context: ScopeOption | { testOnly: boolean } = 'common') {
        if (!Array.isArray(context) && typeof context !== 'string') {
            Logger.warn(`Received scope of wrong type!`, { scope: context });
            for (const exportName of normalizeOptionalArray(name)) {
                this.globalVariables.add('common', exportName);
            }
            return;
        }
        
        for (const scope of normalizeOptionalArray(context)) {
            for (const exportName of normalizeOptionalArray(name)) {
                this.globalVariables.add(scope, exportName);
            }
        }
    }
    
    public mainModule(file: string, scope: Scope = 'common') {
        this.entryModule.set(scope, file);
        const path = Path.join(this.srcDir, file);
        const id = this.createModuleId();
        this.pushToEntrypoint(scope, [
            moduleReExport({ path, }),
            moduleImport({ path, id }),
            `Object.assign(${this.globalKey}, ${id})`
        ]);
        (this.base[scope] || []).push(`require(${JSON.stringify(path)})`);
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
export type EntrypointRecord<TValue = string> = Record<Scope | string, TValue[]>;

