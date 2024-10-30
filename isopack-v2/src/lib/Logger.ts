import { DEBUG } from '../Config';

export const Logger = {
    log: console.log,
    info: console.info,
    error: console.error,
    warn: console.warn,
    success(message: string, ...params: any[]) {
        console.info(`\n ✅  ${message}\n`, ...params);
    },
    debug(...args: LoggerArgs) {
        if (!DEBUG) {
            return;
        }
        console.debug(...args);
    }
};

export type LoggerArgs = [message: any, ...params: any];