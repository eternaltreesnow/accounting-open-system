const is = function (obj, name) {
  return (
    Object.prototype.toString.call(obj).replace(/(^\[object )|(]$)/g, "") ===
    name
  );
};

const isArray = (obj) => is(obj, "Array");
const isObject = (obj) => is(obj, "Object");
const isNum = (obj) => is(obj, "Number");
const isStr = (obj) => is(obj, "String");
const isBool = (obj) => is(obj, "Boolean");
const isFunction = (obj) => is(obj, "Function");
const isDate = (obj) => is(obj, "Date");

const isNumeric = (num) => {
  if (typeof num === "string") {
    return /^\d*(\.\d*)?$/.test(num);
  }
  if (typeof num === "number") {
    return !isNaN(num);
  }
  return false;
};

const isEmptyObject = (obj) => isObject(obj) && Object.keys(obj).length <= 0;
const isEffectObject = (obj) => isObject(obj) && Object.keys(obj).length > 0;
const isEffectString = (str) => isStr(str) && str.length > 0;
const isEffectArray = (arr) => isArray(arr) && arr.length > 0;

const transFloatToDate = (dateNumber) => {
  return new Date(1900, 0, dateNumber - 1);
};

const padZero = (num) => num.toString().padStart(2, "0");

/**
 * 格式化时间
 * @param {Date} date Date数据
 * @param {string} format 时间格式, yyyy表示年份, MM表示月份, dd表示日期, HH表示小时, mm表示分钟, ss表示秒
 * @returns
 */
const formatDate = (date, format = "yyyy-MM-dd HH:mm:ss") => {
  if (!isDate(date)) {
    return null;
  }
  if (!isEffectString(format)) {
    return null;
  }
  return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (match) => {
    switch (match) {
      case "yyyy":
        return date.getFullYear();
      case "MM":
        return padZero(date.getMonth() + 1);
      case "dd":
        return padZero(date.getDate());
      case "HH":
        return padZero(date.getHours());
      case "mm":
        return padZero(date.getMinutes());
      case "ss":
        return padZero(date.getSeconds());
      default:
        return match;
    }
  });
};

const convertFloatDateToString = (dateNumber, format) => {
  const date = transFloatToDate(dateNumber);
  return formatDate(date, format);
};

const formatObj = (obj, keysMap) => {
  const newObj = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    key = key.trim();
    const newKey = keysMap[key] || key;
    newObj[newKey] = value;
  });
  return newObj;
};

/**
 * 汇率合法性处理
 * @param {number} rate
 * @param {number} defaultRate 默认汇率，当汇率不合法时返回该值
 * @returns 合法汇率
 */
const formatExchangeRate = (rate, defaultRate = 1) => {
  if (isNumeric(rate) && rate > 0) {
    return rate;
  } else {
    return defaultRate;
  }
}

/**
 * 反转对象键值对
 */
const reverseKeyValuePairs = (obj) => {
  return Object.entries(obj).reduce((reversed, [key, value]) => {
    reversed[value] = key;
    return reversed;
  }, {});
}

module.exports = {
  isNumeric,
  isEmptyObject,
  isEffectObject,
  isEffectString,
  isEffectArray,
  is,
  isArray,
  isObject,
  isNum,
  isStr,
  isBool,
  isFunction,
  isDate,
  formatDate,
  convertFloatDateToString,
  formatObj,
  reverseKeyValuePairs,
  transFloatToDate,
  formatExchangeRate,
};
