const path = require("path");
const fs = require("fs");
const _ = require("lodash");
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const Log = require("../utils/log");
const { readXlsx, writeXlsx } = require("../utils/xlsx");
const {
  isEffectObject,
  isEffectString,
  formatDate,
} = require("../utils/utils");

const argv = yargs(hideBin(process.argv)).argv;

const Config = {
  inputDir: "./input",
  outputDir: "./output",
  customerFile: "20250227180118_辅助核算_客户.xlsx",

  resultTemplate: {
    凭证字: "记",
    币别: "IDR",
    汇率: 1,
  },
  Elfbar: {
    salesFile: "ELFBAR  2025年1月.xlsx",
    brand: "Elfbar",
    resultFile: "result-ELFBAR.xlsx",
    sampleCode: "140503",
    sampleCodeName: "库存商品(Sample-Elfbar)",
  },
  Voopoo: {
    salesFile: "Voopoo  2025年1月.xlsx",
    brand: "Voopoo",
    resultFile: "result-Voopoo.xlsx",
    sampleCode: "140504",
    sampleCodeName: "库存商品(Sample-Voopoo)",
  },
};

const TAG = "Kingdee Template";

const readSalesData = (brandConfig) => {
  Log.i(TAG, "Start to read Sales data");
  const file = path.resolve(__dirname, Config.inputDir, brandConfig.salesFile);
  Log.i(TAG, `Sales file path: ${file}`);
  const data = readXlsx({
    fileName: file,
    sheetLists: ["Sales"],
    colType: {
      "outbound\n Date": "date",
      "outbound\ndate": "date",
    },
  })["Sales"];
  // 遍历data的每行数据，把key值做处理，value不做处理，key值用正则表达式将空格、换行符、制表符替换为空字符串，然后存入salesData
  const salesData = data
    .map((item) => {
      const obj = {};
      Object.keys(item).forEach((key) => {
        obj[key.replace(/\s|\n|\t/g, "")] = item[key];
      });
      return obj;
    })
    .filter((item) => {
      return isEffectString(item["StoreName"]);
    });
  // 对salesData每行数据进行key的标准化，其中，将 outbounddate 替换为outboundDate
  const standardSalesData = salesData.map((item) => {
    const obj = {};
    Object.keys(item).forEach((key) => {
      if (key === "outbounddate") {
        obj["outboundDate"] = item[key];
      } else {
        obj[key] = item[key];
      }
    });
    return obj;
  });
  return standardSalesData;
};

const readCustomerMap = () => {
  Log.i(TAG, "Start to read Customer Data");
  const file = path.resolve(__dirname, Config.inputDir, Config.customerFile);
  Log.i(TAG, `Customer file path: ${file}`);
  const data = readXlsx({
    fileName: file,
    sheetLists: ["辅助核算_客户"],
  });
  // 取出object key为“辅助核算_客户”的数据，把其中“编码”和“名称”两列作为映射表，其中“名称”作为key，“编码”作为value
  const customerMap = new Map();
  data["辅助核算_客户"].forEach((item) => {
    // 使用正则表达式移除所有空格（包括中间的空格）
    const cleanName = item["名称"].replace(/\s+/g, "").toUpperCase();
    customerMap.set(cleanName, item["编码"]);
  });

  return customerMap;
};

/**
 * salesData数据处理的过程需要划分为三个过程：
 * * 过程一：单行数据的处理
 *  - sample类型判断，当Total=0或非数字时，标识为sample
 *  - 生成 storeName 字段，处理逻辑是将StoreName字段，过滤空格并转为大写形式
 *  - 生成非Sample行的字段信息:
 *    - price: price = Total / OrderQty, 当OrderQty为0时, price = 1
 *    - code: 5001
 *    - codeName: 主营业务收入
 *    - creditAmount: Total
 *  - 生成Sample行的字段信息:
 *    - price: 1
 *    - Total: total = price * OrderQty
 *    - code: Config.sampleCode
 *    - codeName: Config.sampleCodeName
 *    - creditAmount: Total
 *
 * * 过程二：同类型多行数据的聚合处理
 *  - 聚合key: outboundDate_StoreName
 *  - 聚合object数据处理:
 *    - 新增凭证号 voucherNumber 字段, 值为该聚合项的index
 *  - 将聚合object中的Sample和非Sample数据分别处理
 *    - Sample数据:
 *      - 生成额外的行:
 *        - Total: 聚合项下所有Sample数据的Total总和
 *        - OrderQty: 聚合项下所有Sample数据的OrderQty总和
 *        - client: 使用 storeName 作为key，从customerMap中获取对应的编码，如果找不到则返回Error
 *        - code: 560106
 *        - codeName: 样本费
 *        - debitAmount: Total
 *    - 非Sample数据
 *      - 生成额外的行:
 *        - Total: 聚合项下所有非Sample数据的Total总和
 *        - OrderQty: 聚合项下所有非Sample数据的OrderQty总和
 *        - client: 使用 storeName 作为key，从customerMap中获取对应的编码，如果找不到则返回Error
 *        - code: 1122
 *        - codeName: 应收账款
 *        - debitAmount: Total
 * * 过程三：汇总数据
 *  - 每行数据以作为 resultTemplate 作为模板进行填充
 *  - 生成 summary 信息: 新字段的格式为 `Sales revenues-${Config.brand}(${item["StoreName"]})`
 *  - 按照以下映射进行新数据的key和value填充
 *    - 日期: outboundDate
 *    - 凭证号: voucherNumber
 *    - 摘要: summary
 *    - 科目代码: code
 *    - 科目名称: codeName
 *    - 贷方金额: creditAmount
 *    - 借方金额: debitAmount
 *    - 原币金额: Total
 *    - 客户: client
 *    - 单价: price
 *    - 数量: OrderQty
 *    - 存货: StockNo.
 *  - 将数据写入到 resultData 数组中
 *  - 返回resultData
 */

/**
 * 处理销售数据，生成会计凭证数据
 * @param {Array} salesData - 销售数据数组
 * @param {Map} customerMap - 客户映射关系
 * @param {Object} brandConfig - 公司配置信息
 * @returns {Array} - 处理后的会计凭证数据
 */
function processSalesData(salesData, customerMap, brandConfig) {
  const resultData = [];
  const groupedData = new Map();

  // 过程一：处理单行数据
  const processedData = salesData.map((item) => {
    const isSample = !item["Total"] || isNaN(Number(item["Total"]));
    const storeName = item["StoreName"].replace(/\s+/g, "").toUpperCase();
    const orderQty = Number(item["OrderQty"]) || 0;

    const baseData = {
      outboundDate: item["outboundDate"],
      originStoreName: item["StoreName"],
      storeName,
      OrderQty: orderQty,
      StockNo: item["StockNo."],
    };

    if (isSample) {
      return {
        ...baseData,
        isSample: true,
        price: 1,
        Total: orderQty, // price * OrderQty
        code: brandConfig.sampleCode,
        codeName: brandConfig.sampleCodeName,
        creditAmount: orderQty,
      };
    } else {
      const total = Number(item["Total"]);
      return {
        ...baseData,
        isSample: false,
        price: orderQty === 0 ? 1 : total / orderQty,
        Total: total,
        code: "5001",
        codeName: "主营业务收入",
        creditAmount: total,
      };
    }
  });

  // 过程二：聚合处理
  processedData.forEach((item) => {
    const key = `${item.outboundDate}_${item.storeName}`;
    if (!groupedData.has(key)) {
      groupedData.set(key, {
        sampleItems: [],
        normalItems: [],
        outboundDate: item.outboundDate,
        originStoreName: item.originStoreName,
        storeName: item.storeName,
        voucherNumber: groupedData.size + 1,
      });
    }

    const group = groupedData.get(key);
    if (item.isSample) {
      group.sampleItems.push(item);
    } else {
      group.normalItems.push(item);
    }
  });

  // 过程三：生成最终数据
  groupedData.forEach((group) => {
    // 处理常规销售数据
    group.normalItems.forEach((item) => {
      resultData.push({
        ...Config.resultTemplate,
        日期: item.outboundDate,
        凭证号: group.voucherNumber,
        摘要: `Sales revenues-${brandConfig.brand}（${group.originStoreName}）`,
        科目代码: item.code,
        科目名称: item.codeName,
        贷方金额: item.creditAmount,
        借方金额: 0,
        原币金额: item.Total,
        客户: "",
        单价: item.price,
        数量: item.OrderQty,
        存货: item.StockNo,
      });
    });

    // 生成应收账款行
    if (group.normalItems.length > 0) {
      const totalNormal = group.normalItems.reduce(
        (sum, item) => sum + item.Total,
        0
      );
      const totalNormalQty = group.normalItems.reduce(
        (sum, item) => sum + item.OrderQty,
        0
      );
      const client = customerMap.get(group.storeName) || "Error";

      resultData.push({
        ...Config.resultTemplate,
        日期: group.outboundDate,
        凭证号: group.voucherNumber,
        摘要: `Sales revenues-${brandConfig.brand}（${group.originStoreName}）`,
        科目代码: "1122",
        科目名称: "应收账款",
        贷方金额: 0,
        借方金额: totalNormal,
        原币金额: totalNormal,
        客户: client,
        单价: totalNormalQty === 0 ? 1 : totalNormal / totalNormalQty,
        数量: totalNormalQty,
        存货: "",
      });
    }

    // 处理样品数据
    group.sampleItems.forEach((item) => {
      resultData.push({
        ...Config.resultTemplate,
        日期: item.outboundDate,
        凭证号: group.voucherNumber,
        摘要: `Sales revenues-${brandConfig.brand}（${group.originStoreName}）`,
        科目代码: item.code,
        科目名称: item.codeName,
        贷方金额: item.creditAmount,
        借方金额: 0,
        原币金额: item.Total,
        客户: "",
        单价: item.price,
        数量: item.OrderQty,
        存货: item.StockNo,
      });
    });

    // 生成样品费行
    if (group.sampleItems.length > 0) {
      const totalSample = group.sampleItems.reduce(
        (sum, item) => sum + item.Total,
        0
      );
      const totalSampleQty = group.sampleItems.reduce(
        (sum, item) => sum + item.OrderQty,
        0
      );

      resultData.push({
        ...Config.resultTemplate,
        日期: group.outboundDate,
        凭证号: group.voucherNumber,
        摘要: `Sales revenues-${brandConfig.brand}（${group.originStoreName}）`,
        科目代码: "560106",
        科目名称: "样本费",
        贷方金额: 0,
        借方金额: totalSample,
        原币金额: totalSample,
        客户: "",
        单价: 1,
        数量: totalSampleQty,
        存货: "",
      });
    }
  });

  return resultData;
}

const main = async () => {
  Log.i(TAG, `Program started`);

  const brand = argv.brand;
  if (!isEffectString(brand)) {
    Log.i(TAG, `Invalid brand`);
    throw new Error('Invalid brand');
  }
  const brandConfig = Config[brand];
  if (!isEffectObject(brandConfig)) {
    Log.i(TAG, `Invalid brand config`);
    throw new Error('Invalid brand config');
  }

  // 读取sales数据
  const salesData = readSalesData(brandConfig);
  // 读取客户代码映射表
  const customerMap = readCustomerMap();

  // console.log(JSON.stringify(customerMap));

  // 处理sales数据
  const resultData = processSalesData(salesData, customerMap, brandConfig);

  // Log.i(TAG, `Result Data: ${JSON.stringify(resultData)}`);

  const resultFile = path.resolve(
    __dirname,
    Config.outputDir,
    brandConfig.resultFile
  );
  writeXlsx({
    fileName: resultFile,
    data: {
      ["凭证模版"]: resultData,
    },
    headers: {
      日期: "日期",
      凭证字: "凭证字",
      凭证号: "凭证号",
      摘要: "摘要",
      科目代码: "科目代码",
      科目名称: "科目名称",
      单价: "单价",
      数量: "数量",
      借方金额: "借方金额",
      贷方金额: "贷方金额",
      客户: "客户",
      存货: "存货",
      原币金额: "原币金额",
      币别: "币别",
      汇率: "汇率",
    },
  });
  Log.i(TAG, `Program ended`);
};
main();
