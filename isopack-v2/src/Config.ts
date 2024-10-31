import Path from 'node:path';
import process from 'node:process';


export const ROOT_DIR = Path.join(process.env.PWD || '');

export const PACKAGE_TEMP_DIR = Path.join(ROOT_DIR, 'dist', 'packages');
export const PACKAGE_SRC_DIR = Path.join(ROOT_DIR, '..', 'packages');
export const PACKAGE_SRC_DIR_NON_CORE = Path.join(PACKAGE_SRC_DIR, 'non-core');
export const PACKAGE_DIST_DIR = Path.join(PACKAGE_TEMP_DIR, 'dist');
export const PACKAGE_ENTRY_DIR = Path.join(PACKAGE_TEMP_DIR, 'entry');
export const PACKAGE_TSCONFIG_FILE = Path.join(ROOT_DIR, 'tsconfig.packages.json');
export const PACKAGE_TYPES_DIR = Path.join(PACKAGE_TEMP_DIR, 'types', 'meteor');
export const PACKAGE_NPM_DIR = Path.join(PACKAGE_TEMP_DIR, '.npm', 'package');
export const PACKAGE_ENTRY_EXT = 'mjs';

export const PACKAGE_RUNTIME_ENVIRONMENT = Path.join(PACKAGE_ENTRY_DIR, `globals.${PACKAGE_ENTRY_EXT}`);
export const BUNDLE_ASSETS_DIR = Path.join(ROOT_DIR, 'src', 'BundleAssets');
export const NPM_MASTER_MODULE = Path.join(PACKAGE_DIST_DIR, 'npm', 'index.mjs');
export const NO_EXTERNALIZE_NAMESPACES = ['meteor', 'meteor:package', 'meteor:env'];

export const DEBUG = !!process.env.DEBUG;