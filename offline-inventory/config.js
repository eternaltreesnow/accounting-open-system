module.exports = {
  outputDir: './output',
  inputDir: './input',
  summaryFileName: 'summary.xlsx',
  balanceFileName: 'balance.xlsx',
  balanceSheetName: 'balance',
  flowFileName: 'Flow Voopoo 2025.xlsx',
  // todo: 支持多品牌
  brand: [{
    name: 'Voopoo',
    flow: '',
    balance: '',
    summary: '',
  }],
  targetSheetName: {
    inbound: 'Inbound',
    outbound: 'Outbound',
  },
};
