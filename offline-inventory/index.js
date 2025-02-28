const path = require("path");
const fs = require("fs");
const _ = require("lodash");
const Log = require("./utils/log");
const {
  outputDir,
  summaryFileName,
  balanceSheetName,
  inputDir,
  flowFileName,
  targetSheetName,
  balanceFileName,
} = require("./config");
const { readXlsx, writeXlsx } = require("./utils/xlsx");
const {
  isArray,
  isEffectString,
  isEffectObject,
  formatObj,
  reverseKeyValuePairs,
  isEffectArray,
  isNumeric,
  formatExchangeRate,
} = require("./utils/utils");
const { KEYS_MAP, FLOW_TYPE } = require("./const");

const TAG = "main";

const readSummaryData = () => {
  Log.i(TAG, `Start to read Summary Data`);
  const summaryFile = path.resolve(__dirname, outputDir, summaryFileName);
  Log.i(TAG, `Summary File: ${summaryFile}`);
  let summaryData = readXlsx({
    fileName: summaryFile,
    colType: {
      "Order Date": "stringdate",
    },
  });
  if (!isEffectObject(summaryData)) {
    Log.i(TAG, `Summary Data is empty`);
    summaryData = {};
  }
  Object.keys(summaryData).forEach((key) => {
    const value = summaryData[key];
    if (isEffectArray(value)) {
      summaryData[key] = value.map((item) => formatObj(item, KEYS_MAP.SUMMARY));
    }
  });
  // Log.i(TAG, `Summary Data: ${JSON.stringify(summaryData)}`);
  Log.i(TAG, `Finish read Summary Data`);
  return summaryData;
};

const readBalanceData = () => {
  Log.i(TAG, `Start to read Balance Data`);
  const balanceFile = path.resolve(__dirname, outputDir, balanceFileName);
  Log.i(TAG, `Balance File: ${balanceFile}`);
  const balanceData = _.get(
    readXlsx({
      fileName: balanceFile,
      sheetLists: [balanceSheetName],
    }),
    balanceSheetName,
    []
  ).map((item) => formatObj(item, KEYS_MAP.BALANCE));
  if (!isArray(balanceData)) {
    Log.e(TAG, `Balance Data invalid: ${JSON.stringify(balanceData)}`);
    return;
  }
  if (balanceData.length === 0) {
    Log.i(TAG, `库存数据为空`);
  } else {
    // Log.i(TAG, `库存数据有效: ${JSON.stringify(balanceData)}`);
  }
  Log.i(TAG, `Finish read Balance Data`);
  return balanceData;
};

const readFlowData = () => {
  Log.i(TAG, `Start to read Flow Data`);
  const flowFile = path.resolve(__dirname, inputDir, flowFileName);
  Log.i(TAG, `Flow File: ${flowFile}`);
  const flowData = readXlsx({
    fileName: flowFile,
    sheetNames: Object.values(targetSheetName),
    colType: {
      "Inbound Date": "floatdate",
      "Outbound Date": "floatdate",
      Unit: "upperCase",
    },
  });
  const inboundData = _.get(flowData, targetSheetName.inbound, [])
    .map((item) => formatObj(item, KEYS_MAP.INBOUND))
    .filter((item) => {
      const { inboundQuantity } = item || {};
      return inboundQuantity > 0;
    })
    .map((item) => {
      // inbound需要先换算amount，再根据 unit = amount / qty 来计算单价
      const {
        exchangeRate,
        inboundQuantity = 0,
        inboundAmount = 0,
      } = item || {};
      // 非法汇率以 1 计算
      const formatRate = formatExchangeRate(exchangeRate);

      item.inboundAmount = inboundAmount * formatRate;
      item.inboundQuantity = inboundQuantity;
      item.inboundUnitPrice = item.inboundAmount / inboundQuantity;
      item.type = FLOW_TYPE.INBOUND;
      return item;
    });
  const outboundData = _.get(flowData, targetSheetName.outbound, [])
    .map((item) => formatObj(item, KEYS_MAP.OUTBOUND))
    .map((item) => {
      // outbound需要先计算unit，再根据 amount = unit * qty 来计算总价
      const {
        outboundUnitPrice = 0,
        exchangeRate = 1,
        outboundQuantity = 0,
        outboundTotalDiscount = 0,
      } = item || {};
      // 非法汇率以 1 计算
      const formatRate = formatExchangeRate(exchangeRate);

      item.outboundQuantity = outboundQuantity;
      item.outboundUnitPrice = outboundUnitPrice * formatRate;
      // 总价需要扣除掉折扣
      item.outboundAmount =
        item.outboundUnitPrice * outboundQuantity - outboundTotalDiscount;
      item.outboundTotalDiscount = outboundTotalDiscount;
      item.type = FLOW_TYPE.OUTBOUND;
      return item;
    });
  Log.i(TAG, `Finish read Flow Data`);
  return {
    inboundData,
    outboundData,
  };
};

const mergeCategoris = (flowData) => {
  Log.i(TAG, `Start to merge and sort Categoris Data`);
  const { inboundData, outboundData } = flowData || {};
  const mergeData = [].concat(inboundData, outboundData);
  const categorisData = {};
  mergeData.forEach((item) => {
    const { stockNo } = item || {};
    if (!isEffectString(stockNo)) {
      return;
    }
    if (isArray(categorisData[stockNo])) {
      categorisData[stockNo].push(item);
    } else {
      categorisData[stockNo] = [item];
    }
  });
  Object.keys(categorisData).forEach((key) => {
    categorisData[key].sort((a, b) => {
      const { orderDate: aDate, type: aType } = a || {};
      const { orderDate: bDate, type: bType } = b || {};
      // Date对象转成时间戳进行比较
      const aTimestamp = _.isDate(aDate) ? aDate.getTime() : 0;
      const bTimestamp = _.isDate(bDate) ? bDate.getTime() : 0;
      if (aTimestamp > bTimestamp) {
        return 1;
      } else if (aTimestamp < bTimestamp) {
        return -1;
      }
      if (aType === FLOW_TYPE.INBOUND && bType === FLOW_TYPE.OUTBOUND) {
        return -1;
      } else if (bType === FLOW_TYPE.INBOUND && aType === FLOW_TYPE.OUTBOUND) {
        return 1;
      }
      return 0;
    });
  });
  // Log.i(TAG, `categorisData: ${JSON.stringify(categorisData)}`);
  Log.i(TAG, `Finish merge and sort Categoris Data`);
  return categorisData;
};

const calculateMWA = (summaryData, balanceData, categorisData) => {
  Log.i(TAG, `Start to calculate flow using Moving Weighted Average`);
  Object.keys(categorisData).forEach((key) => {
    // 读取历史库存信息，若无则初始化
    const targetIndex = _.findIndex(
      balanceData,
      ({ stockNo }) => stockNo === key
    );
    const balance =
      targetIndex > -1
        ? balanceData[targetIndex]
        : { stockNo: key, balanceUnitPrice: 0, balanceQuantity: 0 };

    let { balanceUnitPrice, balanceQuantity } = balance;

    const details = _.get(summaryData, key, []);

    const flow = categorisData[key];
    flow.forEach((flowRow) => {
      const { type } = flowRow;

      // 入库处理, 需要更新库存单价和库存数量, 无需更新毛利
      if (type === FLOW_TYPE.INBOUND) {
        const { inboundQuantity, inboundUnitPrice } = flowRow;
        const newQuantity = balanceQuantity + inboundQuantity;
        // 库存单价 = (库存单价 * 库存数量 + 入库单价 * 入库数量) / (库存数量 + 入库数量)
        const newPrice =
          (balanceUnitPrice * balanceQuantity +
            inboundUnitPrice * inboundQuantity) /
          newQuantity;
        balanceQuantity = newQuantity;
        balanceUnitPrice = newPrice;

        details.push({
          ...flowRow,
          balanceUnitPrice: newPrice,
          balanceQuantity: newQuantity,
          balanceAmount: newPrice * newQuantity,
        });
      }
      // 出库处理, 需要更新库存数量, 库存单价保持不变, 需更新毛利
      if (type === FLOW_TYPE.OUTBOUND) {
        const { outboundQuantity, outboundAmount = 0 } = flowRow;
        if (outboundQuantity === 0) {
          return;
        }
        balanceQuantity -= outboundQuantity;
        const totalProfit =
          outboundAmount - balanceUnitPrice * outboundQuantity;
        const profitPrice = totalProfit / outboundQuantity;
        const cost = balanceUnitPrice * outboundQuantity;

        details.push({
          ...flowRow,
          balanceUnitPrice,
          balanceQuantity,
          balanceAmount: balanceUnitPrice * balanceQuantity,
          cost,
          unitProfit: profitPrice,
          totalProfit: totalProfit,
        });
      }
    });
    // 流水信息更新回汇总表
    _.set(summaryData, key, details);
    // 商品库存信息更新回库存数据
    const balanceResult = {
      ...balance,
      balanceUnitPrice: balanceUnitPrice,
      balanceQuantity: balanceQuantity,
      balanceAmount: balanceUnitPrice * balanceQuantity,
    };
    if (targetIndex > -1) {
      balanceData[targetIndex] = balanceResult;
    } else {
      balanceData.push(balanceResult);
    }
  });
  // 计算完成后，统一刷新库存数据的更新时间
  balanceData.forEach((balance) => {
    balance.updateDateTime = new Date();
  });
  Log.i(TAG, `Finish calculate flow using Moving Weighted Average`);
};

const main = async () => {
  Log.i(TAG, `Program started`);

  // 读取汇总文件
  const summaryData = readSummaryData();

  // 读取汇总文件中的库存历史数据
  const balanceData = readBalanceData();

  // 读取流水数据, 区分入库/出库/折扣类型
  const flowData = readFlowData();

  // 合并流水数据，并根据商品编码分类，单个分类下根据日期和流水类型排序(日期>入库>折扣>出库)
  const categorisData = mergeCategoris(flowData);

  // 采用"移动加权平均法"对流水进行处理
  calculateMWA(summaryData, balanceData, categorisData);

  // 导出库存数据
  const balanceFile = path.resolve(__dirname, outputDir, balanceFileName);
  writeXlsx({
    fileName: balanceFile,
    data: {
      [balanceSheetName]: balanceData,
    },
    headers: reverseKeyValuePairs(KEYS_MAP.BALANCE),
    colType: {
      updateDateTime: "datetime",
    },
  });

  // 导出流水数据
  const summaryFile = path.resolve(__dirname, outputDir, summaryFileName);
  const summaryHeaders = reverseKeyValuePairs(KEYS_MAP.SUMMARY);
  writeXlsx({
    fileName: summaryFile,
    data: summaryData,
    headers: summaryHeaders,
    colType: {
      orderDate: "date",
    },
  });
};

main();
