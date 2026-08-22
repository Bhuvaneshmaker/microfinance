const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const { branchScopedWhere } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/summary', async (req, res) => {
  const { startDate, endDate, status, branchId } = req.query;
  const branchWhere = branchScopedWhere(req.user, branchId);

  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);
  const loanFilter = {
    ...branchWhere,
    ...(status ? { status } : {}),
    ...(startDate || endDate ? { createdAt: dateFilter } : {}),
  };

  const [loanTotals, paymentTotals, incomeTotals, expenseTotals] = await Promise.all([
    prisma.loan.aggregate({
      _sum: { principalAmount: true, outstandingPrincipal: true, outstandingInterest: true, outstandingFees: true, outstandingPenalties: true },
      where: loanFilter,
    }),
    prisma.loanPayment.aggregate({ _sum: { amount: true }, where: { ...branchWhere, ...(startDate || endDate ? { paymentDate: dateFilter } : {}) } }),
    prisma.incomeRecord.aggregate({ _sum: { amount: true }, where: { ...branchWhere, ...(startDate || endDate ? { date: dateFilter } : {}) } }),
    prisma.expenseRecord.aggregate({ _sum: { amount: true }, where: { ...branchWhere, ...(startDate || endDate ? { date: dateFilter } : {}) } }),
  ]);

  const [loans, applications, payments, customers] = await Promise.all([
    prisma.loan.findMany({ where: loanFilter, include: { customer: true, loanProduct: true, branch: true } }),
    prisma.loanApplication.findMany({ where: branchWhere, include: { customer: true, loanProduct: true, branch: true } }),
    prisma.loanPayment.findMany({ where: { ...branchWhere, ...(startDate || endDate ? { paymentDate: dateFilter } : {}) }, include: { loan: true, branch: true, postedBy: true } }),
    prisma.customer.findMany({ where: branchWhere, include: { branch: true } }),
  ]);

  res.json({
    success: true,
    data: {
      totalLoanPrincipal: loanTotals._sum.principalAmount || 0,
      totalOutstandingPrincipal: loanTotals._sum.outstandingPrincipal || 0,
      totalOutstandingInterest: loanTotals._sum.outstandingInterest || 0,
      totalOutstandingFees: loanTotals._sum.outstandingFees || 0,
      totalOutstandingPenalties: loanTotals._sum.outstandingPenalties || 0,
      totalRepayments: paymentTotals._sum.amount || 0,
      totalIncome: incomeTotals._sum.amount || 0,
      totalExpenses: expenseTotals._sum.amount || 0,
      loans,
      applications,
      payments,
      customers,
    },
  });
});

router.get('/income', async (req, res) => {
  const { startDate, endDate, branchId } = req.query;
  const where = branchScopedWhere(req.user, branchId);
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  const records = await prisma.incomeRecord.findMany({ where, orderBy: { date: 'desc' } });
  res.json({ success: true, data: records });
});

router.get('/expenses', async (req, res) => {
  const { startDate, endDate, branchId } = req.query;
  const where = branchScopedWhere(req.user, branchId);
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  const records = await prisma.expenseRecord.findMany({ where, orderBy: { date: 'desc' } });
  res.json({ success: true, data: records });
});

module.exports = router;
