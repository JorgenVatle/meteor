import { DEBUG } from '../Config';

export const Logger: Pick<typeof console, 'log' | 'debug'> = {
    log: console.log,
    debug(...args: any[]) {
        if (!DEBUG) {
            return;
        }
        console.debug(...args);
    }
};