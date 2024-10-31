import type { EntrypointRecord, Scope } from './Package';

export class ScopedRecord<TValue = string> {
    public readonly data: Partial<EntrypointRecord<TValue>> = {
        common: [],
        server: [],
        client: [],
    };
    
    constructor() {
    }
    
    public get(scope: Scope): TValue[] {
        if (!this.data[scope]) {
            this.data[scope] = [];
        }
        return this.data[scope];
    }
    
    public add(scope: Scope, value: TValue) {
        this.get(scope).push(value);
    }
    
    public get entries() {
        return Object.entries(this.data) as [keyof EntrypointRecord, TValue][];
    }
}