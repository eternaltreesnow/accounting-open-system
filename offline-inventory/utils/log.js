const LOG_LEVEL = {
  noLog: 'noLog',
  log: 'log',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

const LOG_LEVEL_ENUM = {
  [LOG_LEVEL.noLog]: 0,
  [LOG_LEVEL.log]: 10,
  [LOG_LEVEL.info]: 20,
  [LOG_LEVEL.warn]: 30,
  [LOG_LEVEL.error]: 40,
};

const LOG_API = {
  [LOG_LEVEL.noLog]: () => {},
  [LOG_LEVEL.log]: console.log,
  [LOG_LEVEL.info]: console.info,
  [LOG_LEVEL.warn]: console.warn,
  [LOG_LEVEL.error]: console.error,
};

class Log {
  static level = LOG_LEVEL_ENUM[LOG_LEVEL.info];

  static setLevel(level) {
    if (!LOG_LEVEL.keys.includes(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    Log.level = LOG_LEVEL_ENUM[level];
  }

  static getTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const millisecond = now.getMilliseconds();
    return `${year}-${month}-${date} ${hour}:${minute}:${second}:${millisecond}`;
  }

  static formatMessage(tag, msg) {
    const time = Log.getTime();
    return `${time} [OfflineInventory][${tag}]: ${msg}`;
  }

  static generalLog(level, tag, msg) {
    const log = Log.formatMessage(tag, msg);

    if (typeof LOG_API[level] === 'function') {
      LOG_API[level](log);
    }
  }

  static i(tag, msg) {
    if (LOG_LEVEL_ENUM[LOG_LEVEL.info] >= Log.level) {
      Log.generalLog(LOG_LEVEL.info, tag, msg);
    }
  }

  static d(tag, msg) {
    if (LOG_LEVEL_ENUM[LOG_LEVEL.log] >= Log.level) {
      Log.generalLog(LOG_LEVEL.log, tag, msg);
    }
  }

  static w(tag, msg) {
    if (LOG_LEVEL_ENUM[LOG_LEVEL.warn] >= Log.level) {
      Log.generalLog(LOG_LEVEL.warn, tag, msg);
    }
  }

  static e(tag, msg) {
    if (LOG_LEVEL_ENUM[LOG_LEVEL.error] >= Log.level) {
      Log.generalLog(LOG_LEVEL.error, tag, msg);
    }
  }
}

module.exports = Log;
