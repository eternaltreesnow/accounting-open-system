const path = require("path");
const fs = require("fs");
const _ = require("lodash");
const xlsx = require("node-xlsx").default;
const {
  isArray,
  convertFloatDateToString,
  isEffectObject,
  isEffectString,
  transFloatToDate,
  formatDate,
  isNumeric,
} = require("./utils");
const Log = require("./log");

const TAG = "Xlsx";

/**
 * 读取XLSX文件，并转成JSON数据格式
 * {
 *   [sheetName]: [{
 *      [header1]: value1,
 *      [header2]: value2,
 *      ...
 *   }]
 * }
 * @param {string} config.fileName excel文件名
 * @param {string[]} config.sheetLists 指定读取的sheet列表，不传或空数组代表全量sheet读取
 * @param {number} config.headRowIndex 指定读取的sheet的表头行号
 * @returns
 */
exports.readXlsx = (config) => {
  const { fileName, sheetLists = [], headRowIndex = 0, colType = {} } = config;
  try {
    const rawData = xlsx.parse(fileName);
    if (!isArray(rawData)) {
      return null;
    }
    const resultData = {};
    rawData.forEach((sheet) => {
      const { name: sheetName, data: sheetData } = sheet || {};
      // 根据sheetLists读取指定sheet内容
      if (
        isArray(sheetLists) &&
        sheetLists.length > 0 &&
        !sheetLists.includes(sheetName)
      ) {
        return;
      }
      if (!isArray(sheetData)) {
        return;
      }
      const headers = sheetData[headRowIndex];
      if (!isArray(headers)) {
        return;
      }
      const rows = sheetData.slice(headRowIndex + 1);
      if (!isArray(rows)) {
        return;
      }
      resultData[sheetName] = rows.map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          if (!colType[header]) {
            obj[header] = row[index];
            return;
          }
          switch (colType[header]) {
            case "datetime": {
              obj[header] = convertFloatDateToString(
                row[index],
                "yyyy-MM-dd HH:mm"
              );
              break;
            }
            case "date":
              obj[header] = convertFloatDateToString(row[index], "yyyy-MM-dd");
              break;
            case "floatdate":
              obj[header] = transFloatToDate(row[index]);
              break;
            case "stringdate":
              obj[header] = new Date(row[index]);
              break;
            case "upperCase": {
              const originValue = row[index];
              if (isEffectString(originValue)) {
                obj[header] = originValue.toUpperCase();
              } else {
                obj[header] = originValue;
              }
              break;
            }
            case "lowerCase": {
              const originValue = row[index];
              if (isEffectString(originValue)) {
                obj[header] = originValue.toUpperCase();
              } else {
                obj[header] = originValue;
              }
              break;
            }
            default:
              break;
          }
        });
        return obj;
      });
    });
    return resultData;
  } catch (err) {
    Log.e(TAG, `Error reading XLSX file: ${err}`);
    return null;
  }
};

/**
 * 将JSON格式数据写入xlsx文件
 * {
 *   [sheetName1]: [{
 *      [header1]: value1,
 *      [header2]: value2,
 *      ...
 *   }]，
 *   [sheetName2]: [{
 *   }],
 *   ...
 * }
 * @param {*} config.fileName
 * @param {*} config.data
 * @param {*} config.headers
 * @returns
 */
exports.writeXlsx = (config) => {
  const { fileName, data, headers, colType = {} } = config || {};
  try {
    if (!isEffectObject(data)) {
      Log.e(TAG, `Error writing XLSX file: data is not effect object`);
      return null;
    }
    if (!isEffectString(fileName)) {
      Log.e(TAG, `Error writing XLSX file: fileName is not effect string`);
      return null;
    }
    if (!isEffectObject(headers)) {
      Log.e(TAG, `Error writing XLSX file: header is not effect object`);
      return null;
    }
    const headerCols = Object.values(headers);
    const headerKeys = Object.keys(headers);
    const sheetList = [];
    Object.keys(data).forEach((sheetName) => {
      const sheetData = [];
      sheetData.push(headerCols);
      const dataObj = data[sheetName];
      dataObj.forEach((obj) => {
        const row = [];
        headerKeys.forEach((key) => {
          let originValue;
          try {
            originValue = _.get(obj, key, "");
          } catch (err) {
            originValue = '';
            Log.e(TAG, `Error writing XLSX file: ${err}`);
            return;
          }

          if (!colType[key]) {
            row.push(originValue);
            return;
          }
          let value;
          switch (colType[key]) {
            case "datetime": {
              value = formatDate(originValue, "yyyy-MM-dd HH:mm");
              break;
            }
            case "date": {
              value = formatDate(originValue, "yyyy/MM/dd");
              break;
            }
            case "price": {
              if (isNumeric(originValue)) {
                value = Math.round(originValue * 100) / 100;
              } else {
                value = originValue;
              }
              break;
            }
            default: {
              break;
            }
          }
          row.push(value);
        });
        sheetData.push(row);
      });
      sheetList.push({
        name: sheetName,
        data: sheetData,
      });
    });
    const buffer = xlsx.build(sheetList);
    fs.writeFileSync(fileName, buffer);
  } catch (err) {
    Log.e(TAG, `Error writing XLSX file: ${err}`);
    return null;
  }
};
