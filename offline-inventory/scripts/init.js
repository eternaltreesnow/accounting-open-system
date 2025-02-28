const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const Log = require("../utils/log");

const TAG = "Init Program";

const delFile = (fileName, filePath) => {
  return new Promise((resolve, reject) => {
    Log.i(TAG, `检查并删除旧 ${fileName} 文件`);
    fs.stat(filePath, (err, stats) => {
      if (err) {
        Log.i(TAG, `${fileName} 文件不存在，无需做删除操作`);
        resolve();
        return;
      }
      Log.i(TAG, `${fileName} 文件存在, 需要删除`);
      if (stats.isFile()) {
        try {
          fs.unlinkSync(filePath);
          Log.i(TAG, `删除 ${fileName} 文件成功`);
          resolve();
        } catch (error) {
          Log.e(TAG, `删除 ${fileName} 文件失败`);
          Log.e(TAG, error);
          reject(error);
          return;
        }
      } else {
        Log.e(TAG, `${fileName} 不是文件，无法执行删除操作`);
        reject();
        return;
      }
    });
  });
};

const copyFile = (srcFileName, srcFilePath, destFilePath) => {
  return new Promise((resolve, reject) => {
    fs.stat(srcFilePath, (err, stats) => {
      if (err) {
        Log.e(TAG, `${srcFileName} 文件不存在，无法执行删除操作`);
        reject(err);
        return;
      }
      if (stats.isFile()) {
        fs.copyFile(srcFilePath, destFilePath, (error) => {
          if (error) {
            Log.e(TAG, `${srcFileName} 复制错误`);
            Log.e(TAG, error);
            reject(error);
            return;
          }
          Log.i(TAG, `${srcFileName} 复制成功`);
          resolve();
        });
      } else {
        Log.e(TAG, `${srcFileName} 不是文件，无法执行复制操作`);
        reject();
        return;
      }
    });
  });
};

const main = async () => {
  Log.i(TAG, "start");

  const balanceFilePath = path.resolve(__dirname, "../output/balance.xlsx");

  await delFile("balance.xlsx", balanceFilePath);

  const balanceDemoFilePath = path.resolve(
    __dirname,
    "../output/balance_demo.xlsx"
  );
  await copyFile("balance_demo.xlsx", balanceDemoFilePath, balanceFilePath);

  const summaryFilePath = path.resolve(__dirname, "../output/summary.xlsx");

  await delFile("summary.xlsx", summaryFilePath);

  Log.i(TAG, "finish");
};

main();
