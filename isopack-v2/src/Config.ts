import Path from 'node:path';
import process from 'node:process';

export const PACKAGE_TEMP_DIR = Path.join(process.cwd(), '.packages');
export const BUNDLE_ASSETS_DIR = Path.join(process.cwd(), 'src', 'BundleAssets');
export const PACKAGE_DIST_DIR = Path.join(PACKAGE_TEMP_DIR, 'dist');
export const PACKAGE_ENTRY_DIR = Path.join(PACKAGE_TEMP_DIR, 'entry');
export const TYPES_DIST_DIR = Path.join(PACKAGE_TEMP_DIR, 'types');