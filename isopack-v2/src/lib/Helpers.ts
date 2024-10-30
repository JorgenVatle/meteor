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