const path = require("path");
const fs = require("fs");
const Log = require("../utils/log");
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { readXlsx, writeXlsx } = require("../utils/xlsx");

const readCustomerMap = () => {
    Log.i(TAG, "Start to read Customer Data");
    const file = path.resolve(__dirname, './input', '20250227180118_辅助核算_客户.xlsx');
    Log.i(TAG, `Customer file path: ${file}`);
    const data = readXlsx({
      fileName: file,
      sheetLists: ["辅助核算_客户"],
    });
    return data["辅助核算_客户"];
    // // 取出object key为“辅助核算_客户”的数据，把其中“编码”和“名称”两列作为映射表，其中“名称”作为key，“编码”作为value
    // const customerMap = new Map();
    // data["辅助核算_客户"].forEach((item) => {
    //   // 使用正则表达式移除所有空格（包括中间的空格）
    //   const cleanName = item["名称"].replace(/\s+/g, "").toUpperCase();
    //   customerMap.set(cleanName, item["编码"]);
    // });

    // return customerMap;
  };

// 函数：找到两个字符串的最大交叉部分
const findLongestCommonSubstring = (str1, str2) => {
  const matrix = Array.from({ length: str1.length + 1 }, () =>
    Array(str2.length + 1).fill(0)
  );
  let maxLength = 0;
  let endIndex = 0;

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
        if (matrix[i][j] > maxLength) {
          maxLength = matrix[i][j];
          endIndex = i;
        }
      }
    }
  }

  return str1.substring(endIndex - maxLength, endIndex);
};

const TAG = "Kingdee Customer";

const main = async () => {
  const customerMap = readCustomerMap();

  console.log(customerMap);
  /**
   * customerMap是一个对象数组，每个对象中有 名称 和 编码 两个属性
   * 我现在想要分析每个项的名称之间存在交叉的关系，找到交叉字符串最大的部分进行输出
   * 最后把结果写入到output目录下的 duplicate_customer.xlsx 文件中
   */
  // 分析交叉字符串
  const results = [];
  for (let i = 0; i < customerMap.length; i++) {
    for (let j = i + 1; j < customerMap.length; j++) {
      const name1 = customerMap[i].名称;
      const name2 = customerMap[j].名称;
      const commonSubstring = findLongestCommonSubstring(name1, name2);
      if (commonSubstring.length > 0) {
        results.push({
          名称1: name1,
          名称2: name2,
          编码1: customerMap[i].编码,
          编码2: customerMap[j].编码,
          交叉字符串: commonSubstring,
          长度: commonSubstring.length,
        });
      }
    }
  }

  const resultFile = path.resolve(
    __dirname,
    './output',
    'duplicate_customer.xlsx'
  );

  writeXlsx({
    fileName: resultFile,
    data: {
      ["Sheet1"]: results,
    },
    headers: {
      名称1: "名称1",
      名称2: "名称2",
      编码1: "编码1",
      编码2: "编码2",
      交叉字符串: "交叉字符串",
      长度: "长度",
    },
  });
};
main();
