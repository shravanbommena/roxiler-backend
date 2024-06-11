const express = require("express");
const axios = require("axios");
const router = express.Router();
const Transaction = require("../models/Transaction");

// Initialize database with seed data
router.get("/init", async (req, res) => {
  try {
    const response = await axios.get(
      "https://s3.amazonaws.com/roxiler.com/product_transaction.json"
    );
    const transactions = response.data;

    // Pre-process transactions to include month
    const processedTransactions = transactions.map((transaction) => ({
      ...transaction,
      month: new Date(transaction.dateOfSale).getMonth() + 1,
    }));

    await Transaction.deleteMany({});
    await Transaction.insertMany(processedTransactions);

    res.json({ message: "Database initialized with seed data" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List transactions with search and pagination
router.get("/transactions", async (req, res) => {
  const { month, search, page = 1, perPage = 10 } = req.query;
  const query = { month: parseInt(month) };
  if (search) {
    query.$or = [
      { title: new RegExp(search, "i") },
      { description: new RegExp(search, "i") },
      { price: parseFloat(search) },
    ];
  }
  const transactions = await Transaction.find(query)
    .skip((page - 1) * perPage)
    .limit(parseInt(perPage));
  res.json(transactions);
});

// Statistics API
router.get("/statistics", async (req, res) => {
  const { month } = req.query;
  const query = { month: parseInt(month) };
  const totalSaleAmount = await Transaction.aggregate([
    { $match: query },
    { $group: { _id: null, total: { $sum: "$price" } } },
  ]);
  const totalSoldItems = await Transaction.countDocuments({
    ...query,
    sold: true,
  });
  const totalNotSoldItems = await Transaction.countDocuments({
    ...query,
    sold: false,
  });

  res.json({
    totalSaleAmount: totalSaleAmount[0]?.total || 0,
    totalSoldItems,
    totalNotSoldItems,
  });
});

// Bar chart API
router.get("/bar-chart", async (req, res) => {
  const { month } = req.query;
  const query = { month: parseInt(month) };
  const priceRanges = [
    { range: "0-100", min: 0, max: 100 },
    { range: "101-200", min: 101, max: 200 },
    { range: "201-300", min: 201, max: 300 },
    { range: "301-400", min: 301, max: 400 },
    { range: "401-500", min: 401, max: 500 },
    { range: "501-600", min: 501, max: 600 },
    { range: "601-700", min: 601, max: 700 },
    { range: "701-800", min: 701, max: 800 },
    { range: "801-900", min: 801, max: 900 },
    { range: "901-above", min: 901, max: Infinity },
  ];

  const results = await Promise.all(
    priceRanges.map(async (range) => {
      const count = await Transaction.countDocuments({
        ...query,
        price: { $gte: range.min, $lte: range.max },
      });
      return { range: range.range, count };
    })
  );

  res.json(results);
});

// Pie chart API
router.get("/pie-chart", async (req, res) => {
  const { month } = req.query;
  const query = { month: parseInt(month) };
  const categories = await Transaction.aggregate([
    { $match: query },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  res.json(
    categories.map((category) => ({
      category: category._id,
      count: category.count,
    }))
  );
});

// Combined API
router.get("/combined", async (req, res) => {
  const { month } = req.query;
  const transactions = await Transaction.find({ month: parseInt(month) });
  const statistics = await Transaction.aggregate([
    { $match: { month: parseInt(month) } },
    {
      $group: {
        _id: null,
        total: { $sum: "$price" },
        sold: { $sum: { $cond: ["$sold", 1, 0] } },
        notSold: { $sum: { $cond: ["$sold", 0, 1] } },
      },
    },
  ]);
  const barChart = await Transaction.aggregate([
    { $match: { month: parseInt(month) } },
    {
      $bucket: {
        groupBy: "$price",
        boundaries: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, Infinity],
        default: "901-above",
      },
    },
  ]);
  const pieChart = await Transaction.aggregate([
    { $match: { month: parseInt(month) } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  res.json({ transactions, statistics, barChart, pieChart });
});

module.exports = router;
