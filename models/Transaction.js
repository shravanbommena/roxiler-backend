const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  category: String,
  dateOfSale: Date,
  sold: Boolean,
  month: Number,
});

TransactionSchema.pre("save", function (next) {
  const transaction = this;
  transaction.month = transaction.dateOfSale.getMonth() + 1;
  next();
});

module.exports = mongoose.model("Transaction", TransactionSchema);
