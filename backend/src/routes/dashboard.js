const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const { branchScopedWhere } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/summary', async (req, res) => {
  const { branchId } = req.query;
  const branchWhere = branchScopedWhere(req.user, branchId);

  const [totalCustomers, activeLoans, pendingApplications, disbursedLoans, overdueLoans, repayments, incomeTotals, expenseTotals] = await Promise.all([
    prisma.customer.count({ where: branchWhere }),
    prisma.loan.count({ where: { ...branchWhere, status: 'Active' } }),
    prisma.loanApplication.count({ where: { ...branchWhere, status: { in: ['Submitted', 'UnderReview'] } } }),
    prisma.loan.count({ where: { ...branchWhere, status: 'Active' } }),
    prisma.loan.count({ where: { ...branchWhere, status: 'Active', scheduleEntries: { some: { dueDate: { lt: new Date() }, status: { not: 'Paid' } } } } }),
    prisma.loanPayment.aggregate({ _sum: { amount: true }, where: branchWhere }),
    prisma.incomeRecord.aggregate({ _sum: { amount: true }, where: branchWhere }),
    prisma.expenseRecord.aggregate({ _sum: { amount: true }, where: branchWhere }),
  ]);

  const branches = await prisma.branch.findMany({
    where: branchWhere.branchId ? { id: branchWhere.branchId } : {},
    orderBy: { name: 'asc' },
    include: {
      customers: true,
      loans: true,
      loanPayments: true,
      incomeRecords: true,
      expenseRecords: true,
    },
  });

  const branchPerformance = branches
    .filter((branch) => !branchWhere.branchId || branch.id === branchWhere.branchId)
    .map((branch) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      customers: branch.customers.length,
      activeLoans: branch.loans.filter((loan) => loan.status === 'Active').length,
      outstandingPortfolio: branch.loans.reduce((total, loan) => total + loan.outstandingPrincipal + loan.outstandingInterest + loan.outstandingFees + loan.outstandingPenalties, 0),
      repayments: branch.loanPayments.reduce((total, payment) => total + payment.amount, 0),
      income: branch.incomeRecords.reduce((total, record) => total + record.amount, 0),
      expenses: branch.expenseRecords.reduce((total, record) => total + record.amount, 0),
    }));

  res.json({
    success: true,
    data: {
      totalCustomers,
      activeLoans,
      pendingApplications,
      disbursedLoans,
      overdueLoans,
      totalRepayments: repayments._sum.amount || 0,
      totalIncome: incomeTotals._sum.amount || 0,
      totalExpenses: expenseTotals._sum.amount || 0,
      outstandingPortfolioBalance: branchPerformance.reduce((total, branch) => total + branch.outstandingPortfolio, 0),
      branchPerformance,
    },
  });
});

module.exports = router;
