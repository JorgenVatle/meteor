import Path from 'node:path';
import { PACKAGE_ENTRY_EXT, PACKAGE_SRC_DIR } from '../Config';

export function normalizeOptionalArray<TType extends string>(input: TType | TType[]): TType[] {
    if (Array.isArray(input)) {
        return input;
    }
    return [input];
}

export function packagePath(name: string) {
    return Path.join(PACKAGE_SRC_DIR, name, 'package.js');
}


/**
 * @example
 * esmImportString({ path: 'foo' })
 *  // -> import "foo"
 *
 * esmImportString({ path: '/home/node/foo.js', fromDir: '/root' })
 * // -> import "../home/node/foo.js"
 *
 * @param config
 */
export function moduleImport(config: ModuleImportConfig): string {
    let from: string | undefined = config.fromDir;
    let path = config.path;
    const comments: string[] = [];
    
    if (config.fromFile) {
        from = Path.dirname(config.fromFile);
    }
    
    if (from) {
        path = './' + Path.relative(from, path);
    }
    
    if (PACKAGE_ENTRY_EXT) {
        const REGEX = /\.(js|mjs)$/;
        if (path.match(REGEX)) {
            comments.push(`Original import path: ${path}`);
        }
        path = path.replace(REGEX, `.${PACKAGE_ENTRY_EXT}`);
    }
    
    const result = (string: string) => {
        return [
            ...comments.map((message) => `// ${message}`),
            string
        ].join('\n');
    }
    
    if (config.reExport) {
        return result(`export * from ${JSON.stringify(path)};`);
    }
    
    return result(`import ${JSON.stringify(path)};`);
}

export function moduleReExport(config: Omit<ModuleImportConfig, 'reExport'>) {
    return moduleImport({
        ...config,
        reExport: true,
    })
}

interface ModuleImportConfig {
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
}
