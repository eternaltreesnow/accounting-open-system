const path = require('path');
const fs = require('fs');
const xlsx = require('node-xlsx').default;

const TAG = 'invoice-excel-program';

const srcDir = './data/Invoice 2024/';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const transFloatToDate = (dateNumber) => {
  return new Date(1900, 0, dateNumber - 1);
};

const formatDate = (dateNumber) => {
  const date = transFloatToDate(dateNumber);
  const day = date.getDate(); // 获取日
  const monthIndex = date.getMonth(); // 获取月份索引(0~11)
  const year = date.getFullYear().toString().slice(-2); // 获取年份末尾后两位

  return `${day}-${monthNames[monthIndex]}-${year}`;
};

const isNumeric = (num) => {
  if (typeof num === 'string') {
    return /^\d*(\.\d*)?$/.test(num);
  }
  if (typeof num === 'number') {
    return !isNaN(num);
  }
  return false;
};

const readSheet = ({ filePath }) => {
  if (!filePath) {
    console.error(`${TAG} readSheet error: filePath is empty`);
    return;
  }
  const excelObj = xlsx.parse(filePath);
  let result = [];
  for (const sheet in excelObj) {
    const sheetItem = excelObj[sheet];
    const sheetData = sheetItem.data;
    const data = parseData(sheetData);
    result = result.concat(data);
  }
  return result;
};

const parseData = (data) => {
  console.log('parseData');
  //   console.log(data);
  const rowCount = data.length;
  const result = [];
  let orderDate = '';
  let invoiceNo = '';
  let storeName = '';
  let diskonTotal = 0;
  let subTotal = 0;
  let storeNameReadFlag = false;
  let itemReadFlag = false;

  // 先遍历一次数据，把公共数据提取出来
  for (let i = 0; i < rowCount; i++) {
    const rowData = data[i].filter((item) => item !== '' && item !== undefined && item !== null);
    if (rowData.length === 0) {
      continue;
    }
    // 读取到 Kepada 后，读取下一行第一个内容作为 storeName
    if (storeNameReadFlag) {
      storeName = rowData[0];
      storeNameReadFlag = false;
    }
    if (rowData.indexOf('Kepada:') > -1 || rowData.indexOf('Kepada :') > -1) {
      storeNameReadFlag = true;
    }

    // 读取到 INV No: 后，读取同行下一个元素作为 invoiceNo
    if (rowData.indexOf('INV No:') > -1) {
      const invoiceNoIdx = rowData.indexOf('INV No:') + 1;
      invoiceNo = rowData[invoiceNoIdx];
    }
    // 读取到 Date: 后，读取同行下一个元素作为 orderDate
    if (rowData.indexOf('Date:') > -1) {
      const orderDateIdx = rowData.indexOf('Date:') + 1;
      orderDate = formatDate(rowData[orderDateIdx]);
    }

    // 读取到 Diskon 后，读取同行下一个元素作为 diskonTotal
    const itemCount = rowData.length;
    let diskonIdx = -1;
    for (let j = 0; j < itemCount; j++) {
      const item = rowData[j];
      if (typeof item === 'string' && item.includes('Diskon')) {
        diskonIdx = j;
      }
    }
    if (diskonIdx > -1) {
        diskonTotal = rowData[diskonIdx + 1];
    }

    // 读取到 Sub Total 后，读取同行下一个元素作为 subTotal
    if (rowData.indexOf('Sub Total') > -1) {
      const subTotalIdx = rowData.indexOf('Sub Total') + 1;
      subTotal = rowData[subTotalIdx];
    }
  }

  let discount = 0;
  if (isNumeric(subTotal) && subTotal > 0 && isNumeric(diskonTotal) && diskonTotal > 0) {
    // discount = (diskonTotal / subTotal).toFixed(4);
    discount = diskonTotal / subTotal;
  }

  console.log(`orderDate: ${orderDate}`);
  console.log(`invoiceNo: ${invoiceNo}`);
  console.log(`storeName: ${storeName}`);
  console.log(`diskonTotal: ${diskonTotal}`);
  console.log(`subTotal: ${subTotal}`);
  console.log(`discount: ${discount}`);

  // // 第二遍历时，核心提取表格明细并做组合运算
  // for (let i = 0; i < rowCount; i++) {
  //   const rowData = data[i];
  //   // 读取到 Kode Barang 后，启动读取表格明细
  //   // 读取到 TOTAL QTY 后，代表表格明细读取结束
  //   if (rowData.indexOf('Kode Barang') > -1) {
  //     itemReadFlag = true;
  //     continue;
  //   }
  //   if (rowData.indexOf('TOTAL QTY') > -1 || rowData.indexOf('TOTAL') > -1) {
  //     itemReadFlag = false;
  //     continue;
  //   }
  //   if (itemReadFlag) {
  //     const type = rowData[0];
  //     const detail = rowData[1];
  //     const orderQty = rowData[2];
  //     const price = rowData[3];
  //     const discountTotal = (orderQty * price * discount).toFixed(0);
  //     const total = (orderQty * price - discount).toFixed(0);
  //     const item = [];
  //     item.push(orderDate);
  //     item.push('');
  //     item.push(invoiceNo);
  //     item.push(storeName);
  //     item.push('');
  //     item.push('');
  //     item.push(type);
  //     item.push(detail);
  //     item.push(orderQty);
  //     item.push(price);
  //     item.push(discountTotal);
  //     item.push(total);
  //     result.push(item);
  //   }
  // }
  //   console.log(result);
  return result;
};

const findExcelFiles = (dirPath) => {
  let filePaths = []; // 用于存储找到的文件路径

  try {
    const files = fs.readdirSync(dirPath); // 读取目录内所有文件/文件夹
    files.forEach((file) => {
      const filePath = path.join(dirPath, file); // 构建完整路径
      const stats = fs.statSync(filePath);
      // 如果是目录，则递归查找
      if (stats.isDirectory()) {
        const subFilePaths = findExcelFiles(filePath);
        filePaths = filePaths.concat(subFilePaths);
      } else if (path.extname(file) === '.xlsx') {
        // 如果是.xlsx文件
        filePaths.push(filePath); // 添加到文件路径数组
      }
    });
  } catch (err) {
    console.error('读取目录失败:', err);
    return;
  }

  return filePaths;
};

const writeSheet = ({ filePath, header = [], data = [] }) => {
  console.log(`writeSheet: 开始输出文件`);
  const sheetList = [];
  const sheetName = 'Sheet1';
  const sheetText = [];
  sheetText.push(header);
  for (const item of data) {
    sheetText.push(item);
  }
  console.log(`writeSheet 写入数据`);
  console.log(sheetText);
  sheetList.push({
    name: sheetName,
    data: sheetText,
  });
  const destFilePath = path.resolve(__dirname, filePath);
  try {
    const buffer = xlsx.build(sheetList);
    fs.writeFileSync(destFilePath, buffer);
    console.log(`writeSheet: 完成输出文件`);
  } catch (err) {
    console.error(`writeSheet: 写入xlsx文件报错`);
    console.error(err);
  }
};

function main() {
    console.log('start');
    const dirPath = path.resolve(__dirname, './data/Invoice 2023');
    const filePaths = findExcelFiles(dirPath);
    console.log(`找到的Excel文件数量: ${filePaths.length}`);

    let excelData = [];
    for (const filePath of filePaths) {
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        const data = readSheet({ filePath });
        excelData = excelData.concat(data);
      }
    }
    console.log('excelData');
    console.log(excelData);

    const header = [
      'Order Date',
      'Payment Date',
      'Invocie No.',
      'Store Name',
      'Sales',
      'Area',
      '大类',
      'Detial',
      'Order Qty',
      'Price',
      'Discount',
      'Total',
    ];

    writeSheet({
      filePath: path.resolve(__dirname, './output/result.xlsx'),
      header,
      data: excelData,
    });

//   const srcFile = './87 Vape Store/Invoice 87 Vape Store 2024.xlsx';
//   const filePath = path.resolve(__dirname, srcDir, srcFile);
//   console.log(`filePath: ${filePath}`);
//   const srcData = readSheet({ filePath });
}

main();
