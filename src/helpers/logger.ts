import * as winston from 'winston';
import { format, Logger, Logger as Lo } from 'winston';

/*
  error:   0 — messages
  warn:    1 — messages
  info:    2 — messages
  http:    3 - ×
  verbose: 4 — messages
  debug:   5 — processed data
  silly:   6 — http requests
 */

class DLogger {
    private log: Lo;

    constructor() {
        const loggerFormatter = format.printf(info =>
            `[${info.timestamp}] (${info.service ?? '?'}) ${info.level.toUpperCase()}: ${info.message}`
        );

        const formatter = format.combine(
            format.timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }), loggerFormatter,
        );

        this.log = winston.createLogger({
            level: 'silly',
            format: winston.format.json(),
            transports: [
                new winston.transports.File({
                    filename: 'log_error.log',
                    level: 'error',
                    format: formatter,
                }),

                new winston.transports.File({
                    filename: 'log_info.log',
                    level: 'info',
                    format: formatter,
                }),

                new winston.transports.File({
                    filename: 'log_full.log',
                    format: formatter,
                }),
            ],
        });

        this.log.add(new winston.transports.Console({
            format: formatter,
            level: 'verbose'
        }));
    }

    public getLogger(moduleName: string): Logger {
        return this.log.child( { service: moduleName });
    }
}

const Log = new DLogger();

export { Log, DLogger };
