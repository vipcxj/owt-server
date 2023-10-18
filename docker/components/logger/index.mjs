import log4js from 'log4js';

const LOG_LEVEL = process.env.LOG_LEVEL || 'trace';

log4js.addLayout("json", function (config) {
    return function (logEvent) {
        return JSON.stringify(logEvent) + config.separator;
    };
});

log4js.configure({
    appenders: {
        stdout: { type: "stdout", layout: { type: "json", separator: "\n" } },
        server: { type: "tcp-server", host: "0.0.0.0", layout: { type: "json", separator: "," } },
    },
        categories: {
        default: { appenders: ["stdout"], level: LOG_LEVEL },
    },
});

async function wait() {
    while (true)
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, 1000);
        })
}
wait();