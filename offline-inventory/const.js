const KEYS_MAP = {
  INBOUND: {
    "Stock No": "stockNo",
    "Product Name": "productName",
    Unit: "unit",
    Quantity: "inboundQuantity",
    "Exchange Rate": "exchangeRate",
    Price: "inboundUnitPrice",
    Total: "inboundAmount",
    "Inbound Date": "orderDate",
    Supplier: "client",
    Invoice: "invoice",
    Remark: "remark",
  },
  OUTBOUND: {
    "Stock No": "stockNo",
    "Product Name": "productName",
    Unit: "unit",
    Quantity: "outboundQuantity",
    "Exchange Rate": "exchangeRate",
    Discount: "outboundTotalDiscount",
    Price: "outboundUnitPrice",
    Total: "outboundAmount",
    "Outbound Date": "orderDate",
    Client: "client",
    Invoice: "invoice",
    Remark: "remark",
  },
  BALANCE: {
    "Update Date": "updateDateTime",
    "Stock No": "stockNo",
    "Product Name": "productName",
    "Balance Unit Price": "balanceUnitPrice",
    "Balance Qty": "balanceQuantity",
    "Balance Amount": "balanceAmount",
  },
  SUMMARY: {
    "Order Date": "orderDate",
    "Stock No": "stockNo",
    "Product Name": "productName",
    "Supplier/Client": "client",
    "Flow Type": "type",
    Unit: "unit",
    "Inbound Unit Price": "inboundUnitPrice",
    "Inbound Qty": "inboundQuantity",
    "Inbound Amount": "inboundAmount",
    "Outbound Unit Price": "outboundUnitPrice",
    "Outbound Qty": "outboundQuantity",
    "Outbound Discount": "outboundTotalDiscount",
    Sales: "outboundAmount",
    Cost: "cost",
    "Balance Unit Price": "balanceUnitPrice",
    "Balance Qty": "balanceQuantity",
    "Balance Amount": "balanceAmount",
    "Unit Profit": "unitProfit",
    "Total Profit": "totalProfit",
    Invoice: "invoice",
    Remark: "remark",
  },
};

/**
 * 流水类型
 */
const FLOW_TYPE = {
  INBOUND: "inbound", // 入库
  OUTBOUND: "outbound", // 出库
};

module.exports = {
  KEYS_MAP,
  FLOW_TYPE,
};
