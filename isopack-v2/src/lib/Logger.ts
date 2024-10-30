import { DEBUG } from '../Config';

export const Logger = {
    log: console.log,
    info: console.info,
    error: console.error,
    warn: console.warn,
    debug(...args: [message: any, ...params: any]) {
        if (!DEBUG) {
            return;
        }
        console.debug(...args);
    }
};