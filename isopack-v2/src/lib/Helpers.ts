import Path from 'node:path';
import process from 'node:process';

export function normalizeOptionalArray<TType extends string>(input: TType | TType[]): TType[] {
    if (Array.isArray(input)) {
        return input;
    }
    return [input];
}

export function packagePath(name: string) {
    return Path.join(process.cwd(), '..', 'packages', name, 'package.js');
}

export function esmImportString(config: {
    /**
     * Path to the module to import. Can be absolute or relative.
     */
    path: string;
    /**
     * Whether to create a relative import path, starting from the directory of this file.
     */
    fromFile?: string;
    
    /**
     * Same as fromFile, just starting from the provided directory.
     */
    fromDir?: string;
    
    /**
     * Whether to re-export everything exported by the provided module.
     */
    reExport?: boolean;
}) {
    let from: string | undefined = config.fromDir;
    let path = config.path;
    
    if (config.fromFile) {
        from = Path.dirname(config.fromFile);
    }
    
    if (from) {
        path = './' + Path.relative(from, path);
    }
    
    if (config.reExport) {
        return `export * from ${JSON.stringify(path)};`;
    }
    
    return `import ${JSON.stringify(path)};`;
}