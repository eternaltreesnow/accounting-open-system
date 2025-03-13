const path = require("path");
const fs = require("fs");
const _ = require("lodash");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const Log = require("../utils/log");
const { readXlsx, writeXlsx } = require("../utils/xlsx");
const {
  isEffectObject,
  isEffectString,
  isEffectArray,
} = require("../utils/utils");

const TAG = "JDY Template";

const logFile = path.resolve(__dirname, "./output/log.txt");

const argv = yargs(hideBin(process.argv)).argv;

const Config = {
  inputDir: "./input",
  outputDir: "./output",
  customerFile: "20250313190548_辅助核算_客户.xlsx",

  resultTemplate: {},
  Elfbar: {
    salesFile: "Open System sales&purchase-ELFBAR 05Mar2025.xlsx",
    brand: "Elfbar",
    orderFile: "销售订单-Elfbar.xlsx",
    outboundFile: "销售出库-Elfbar.xlsx",
    warehouse: "Elfbar",
    sampleWarehouse: "Elfbar-样品仓",
  },
  Voopoo: {
    salesFile: "Open System sales&purchase-Voopoo 10Mar2025.xlsx",
    brand: "Voopoo",
    orderFile: "销售订单-Voopoo.xlsx",
    outboundFile: "销售出库-Voopoo.xlsx",
    warehouse: "Voopoo",
    sampleWarehouse: "Voopoo-样品仓",
  },
};

const readSalesData = (brandConfig) => {
  Log.i(TAG, "Start to read Sales data");
  const file = path.resolve(__dirname, Config.inputDir, brandConfig.salesFile);
  Log.i(TAG, `Sales file path: ${file}`);
  const data = readXlsx({
    fileName: file,
    sheetLists: ["Sales"],
    colType: {
      "Order \nDate": "date",
      "Order\n Date": "date",
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
      obj[key] = item[key];
    });
    obj["outboundDate"] = item["outboundDate"] || item["outbounddate"];
    obj["invoiceNo"] = item["InvoiceNo."] || item["InvocieNo."];
    obj["orderDate"] = item["OrderDate"];
    obj["unit"] = item["UNIT"];
    obj["stockNo"] = item["StockNo."];
    obj["storeName"] = item["StoreName"];
    obj["orderQty"] = item["OrderQty"];
    obj["outboundQty"] = item["Outbound"];
    obj["price"] = item["Price"];
    obj["discount"] = item["Discount"];
    obj["total"] = item["Total"];
    obj["remark"] = item["Remark"];
    return obj;
  });
  Log.i(TAG, `salesData length: ${salesData.length}`);
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
  Log.i(TAG, `Customer map size: ${customerMap.size}`);
  return customerMap;
};

/**
 * salesData数据处理的过程需要划分为三个过程：
 * * 过程一：sample类型判断，当Total=0或非数字时，标识为sample
 * * 过程二：分类型字段处理
 *  - sample类型：
 *      - warehouse: 使用Config.sampleWarehouse
 *  - 非sample类型
 *      - warehouse: 使用Config.warehouse
 * * 过程三：通用字段处理
 *  - orderDate: OrderDate
 *  - outboundDate: outboundDate
 *  - orderNo: InvoiceNo.
 *  - clientNo: 使用 storeName 作为key，从customerMap中获取对应的编码，如果找不到则返回Error
 *  - productNo: stockNo
 *  - unit: unit
 *  - price: Price
 *  - quantity: OrderQty
 *  - discount: Discount
 *  - total: Total
 *  - remark: Remark
 *  - 将数据写入到 resultData 数组中
 *  - 返回resultData
 */
const processSalesOrder = (salesData, customerMap, brandConfig) => {
  const orderData = [];
  const outboundData = [];
  const orderGroupedData = new Map();
  const outboundGroupedData = new Map();

  // 过滤不需要处理的数据
  const filteredData = salesData.filter((item) => {
    const invoiceNo = item["invoiceNo"];
    return !(
      !isEffectString(invoiceNo) ||
      invoiceNo === "Inventory adjustment" ||
      invoiceNo.toLowerCase().includes("buyback") ||
      invoiceNo.toLowerCase().includes("cancel")
    );
  });

  // 单行数据做处理
  filteredData.forEach((item) => {
    const standardStoreName = item["storeName"]
      .replace(/\s+/g, "")
      .toUpperCase();
    item["clientNo"] = customerMap.get(standardStoreName) || "Error";
    // 将invoiceNo中的斜杠替换为连字符
    item["invoiceNo"] = item["invoiceNo"].replace(/\//g, "-").toUpperCase();
  });

  // 使用 orderDate + outboundDate + invoiceNo + storeName 对销售订单进行分组处理
  filteredData.forEach((item) => {
    const key = `${item.orderDate}_${item.outboundDate}_${item.invoiceNo}_${item.storeName}`;
    if (!orderGroupedData.has(key)) {
      orderGroupedData.set(key, {
        sampleItem: [],
        commonItem: [],
        orderDate: item.orderDate,
        outboundDate: item.outboundDate,
        invoiceNo: item.invoiceNo,
        storeName: item.storeName,
      });
    }
    const group = orderGroupedData.get(key);
    // 分类型字段处理
    const isSample = !item["total"] || isNaN(Number(item["total"]));
    if (isSample) {
      item["warehouse"] = brandConfig.sampleWarehouse;
      group.sampleItem.push(item);
    } else {
      item["warehouse"] = brandConfig.warehouse;
      group.commonItem.push(item);
    }
  });

  // 处理销售订单输出
  orderGroupedData.forEach((group) => {
    const {
      sampleItem,
      commonItem,
      orderDate,
      outboundDate,
      invoiceNo,
      storeName,
    } = group || {};
    // 对于仅有sample或replacement的订单，无需输出
    if (!isEffectArray(commonItem)) {
      Log.i(
        TAG,
        `纯 sample 或 replacement 的订单，无需输出. orderDate: ${orderDate}, outboundDate: ${outboundDate}, invoiceNo: ${invoiceNo},  storeName: ${storeName}`
      );
      return;
    }

    const totalItems = [].concat(commonItem, sampleItem);

    // 针对订单总数为0的订单，无需输出
    let totalQty = 0;
    totalItems.forEach((item) => {
      totalQty += Number(item["orderQty"]);
    });
    if (totalQty === 0) {
      Log.i(
        TAG,
        `订单总数为0的订单，无需输出. orderDate: ${orderDate}, outboundDate: ${outboundDate}, invoiceNo: ${invoiceNo},  storeName: ${storeName}`
      );
      return;
    }

    totalItems.forEach((item, index) => {
      const obj = {};
      // 只针对聚合内第一行数据写入单据号
      if (index === 0) {
        obj["订单日期"] = orderDate;
        obj["交货日期"] = outboundDate;
        obj["订单编号"] = invoiceNo;
        obj["客户编号"] = item["clientNo"];
      }

      // 通用字段处理
      obj["商品编号"] = item["stockNo"];
      obj["单位"] = item["unit"];
      obj["数量"] = item["orderQty"];
      obj["单价"] = item["price"];
      obj["折扣额"] = item["discount"];
      obj["金额"] = item["total"];
      obj["仓库"] = item["warehouse"];
      obj["备注"] = item["remark"];
      orderData.push(obj);
    });
  });

  // 使用 outboundDate + invoiceNo + storeName 对销售单进行分组处理
  filteredData.forEach((item) => {
    const key = `${item.outboundDate}_${item.invoiceNo}_${item.storeName}`;
    if (!outboundGroupedData.has(key)) {
      outboundGroupedData.set(key, {
        sampleItem: [],
        commonItem: [],
        outboundDate: item.outboundDate,
        invoiceNo: item.invoiceNo,
        storeName: item.storeName,
      });
    }
    const group = outboundGroupedData.get(key);
    // 分类型字段处理
    const isSample = !item["total"] || isNaN(Number(item["total"]));
    if (isSample) {
      item["warehouse"] = brandConfig.sampleWarehouse;
      group.sampleItem.push(item);
    } else {
      item["warehouse"] = brandConfig.warehouse;
      group.commonItem.push(item);
    }
  });

  // 处理销售单输出
  outboundGroupedData.forEach((group) => {
    const { sampleItem, commonItem, outboundDate, invoiceNo, storeName } = group || {};

    const totalItems = [].concat(commonItem, sampleItem);

    // 针对订单总数为0的订单，无需输出
    let totalQty = 0;
    totalItems.forEach((item) => {
      totalQty += Number(item["outboundQty"]);
    });
    if (totalQty === 0) {
      Log.i(
        TAG,
        `出库总数为0的订单，无需输出. outboundDate: ${outboundDate}, invoiceNo: ${invoiceNo}, storeName: ${storeName}`
      );
      return;
    }

    totalItems.forEach((item, index) => {
      const obj = {};
      // 只针对聚合内第一行数据写入单据号
      if (index === 0) {
        obj["单据日期"] = outboundDate;
        obj["客户编号"] = item["clientNo"];
      }

      // 通用字段处理
      obj["商品编号"] = item["stockNo"];
      obj["单位"] = item["unit"];
      obj["数量"] = item["outboundQty"];
      obj["单价"] = item["price"];
      obj["折扣额"] = item["discount"];
      obj["金额"] = item["total"];
      obj["仓库"] = item["warehouse"];
      obj["备注"] = item["remark"];
      outboundData.push(obj);
    });
  });

  // Log.i(TAG, `orderData: ${JSON.stringify(orderData)}`);
  // Log.i(TAG, `outboundData: ${JSON.stringify(outboundData)}`);

  return {
    orderData,
    outboundData,
  };
};

const main = async () => {
  try {
    fs.unlinkSync(logFile);
    Log.i(TAG, `历史日志文件删除成功`);
    Log.setFile(logFile);
  } catch (err) {
    Log.i(TAG, `历史日志文件不存在 或 删除失败`);
  }
  Log.i(TAG, `Program started`);

  const brand = argv.brand;
  if (!isEffectString(brand)) {
    Log.i(TAG, `Invalid brand`);
    throw new Error("Invalid brand");
  }
  const brandConfig = Config[brand];
  if (!isEffectObject(brandConfig)) {
    Log.i(TAG, `Invalid brand config`);
    throw new Error("Invalid brand config");
  }

  // 读取sales数据
  const salesData = readSalesData(brandConfig);
  // 读取客户代码映射表
  const customerMap = readCustomerMap();

  // console.log(JSON.stringify(customerMap));

  // 处理销售订单
  const { orderData, outboundData } = processSalesOrder(
    salesData,
    customerMap,
    brandConfig
  );

  const resultOrderFile = path.resolve(
    __dirname,
    Config.outputDir,
    brandConfig.orderFile
  );
  writeXlsx({
    fileName: resultOrderFile,
    data: {
      ["销售订单"]: orderData,
    },
    headers: {
      订单日期: "订单日期",
      交货日期: "交货日期",
      订单编号: "订单编号",
      客户编号: "客户编号",
      商品编号: "商品编号",
      单位: "单位",
      数量: "数量",
      单价: "单价",
      折扣额: "折扣额",
      金额: "金额",
      仓库: "仓库",
      备注: "备注",
    },
  });
  Log.i(TAG, `销售订单输出成功: ${brandConfig.orderFile}`);

  const resultOutboundFile = path.resolve(
    __dirname,
    Config.outputDir,
    brandConfig.outboundFile
  );
  writeXlsx({
    fileName: resultOutboundFile,
    data: {
      ["销货单"]: outboundData,
    },
    headers: {
      单据日期: "单据日期",
      客户编号: "客户编号",
      商品编号: "商品编号",
      单位: "单位",
      数量: "数量",
      单价: "单价",
      折扣额: "折扣额",
      金额: "金额",
      仓库: "仓库",
      备注: "备注",
    },
  });
  Log.i(TAG, `销货单输出成功: ${brandConfig.outboundFile}`);

  Log.i(TAG, `Program ended`);
};
main();
