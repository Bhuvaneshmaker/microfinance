const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { branchScopedWhere, canViewAllBranches, createAuditLog, queueNotification, resolveBranchId } = require('../helpers');

const router = express.Router();
router.use(auth);

function addFrequency(date, frequency) {
  const next = new Date(date);
  if (frequency === 'Weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'Biweekly') {
    next.setDate(next.getDate() + 14);
  } else if (frequency === 'Quarterly') {
    next.setMonth(next.getMonth() + 3);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function buildSchedule(disbursementDate, principal, interestRate, tenorMonths, frequency) {
  let installments = tenorMonths;
  if (frequency === 'Weekly') {
    installments = tenorMonths * 4;
  } else if (frequency === 'Biweekly') {
    installments = tenorMonths * 2;
  } else if (frequency === 'Quarterly') {
    installments = Math.max(1, Math.ceil(tenorMonths / 3));
  }

  const totalInterest = principal * (interestRate / 100) * (tenorMonths / 12);
  const installmentPrincipal = principal / installments;
  const installmentInterest = totalInterest / installments;
  const schedule = [];
  let dueDate = new Date(disbursementDate);

  for (let i = 1; i <= installments; i += 1) {
    dueDate = addFrequency(dueDate, frequency);
    schedule.push({
      installmentNumber: i,
      dueDate,
      principalDue: parseFloat(installmentPrincipal.toFixed(2)),
      interestDue: parseFloat(installmentInterest.toFixed(2)),
      feesDue: 0,
      penaltiesDue: 0,
      totalDue: parseFloat((installmentPrincipal + installmentInterest).toFixed(2)),
      amountPaid: 0,
      status: 'Pending',
    });
  }

  return schedule;
}

function allocatePaymentToSchedule(paymentAmount, scheduleEntries) {
  let remaining = paymentAmount;
  const updates = [];

  for (const entry of scheduleEntries) {
    if (remaining <= 0) break;
    const remainingDue = entry.totalDue - entry.amountPaid;
    if (remainingDue <= 0) continue;

    const paymentToEntry = Math.min(remaining, remainingDue);
    remaining -= paymentToEntry;
    const amountPaid = entry.amountPaid + paymentToEntry;
    updates.push({
      id: entry.id,
      amountPaid,
      status: amountPaid >= entry.totalDue ? 'Paid' : 'Partial',
    });
  }

  return { remaining, updates };
}

router.get('/', async (req, res) => {
  const { branchId, status } = req.query;
  const where = branchScopedWhere(req.user, branchId);
  if (status) {
    where.status = status;
  }
  const loans = await prisma.loan.findMany({ where, orderBy: { createdAt: 'desc' }, include: { customer: true, loanProduct: true, branch: true } });
  res.json({ success: true, data: loans });
});

router.get('/pending-disbursement', authorize({ permissions: ['canPostPayments', 'canApproveLoans'] }), async (req, res) => {
  const { branchId } = req.query;
  const pending = await prisma.loanApplication.findMany({
    where: { ...branchScopedWhere(req.user, branchId), status: 'Approved' },
    orderBy: { approvedAt: 'desc' },
    include: { customer: true, loanProduct: true, createdBy: true, branch: true },
  });
  res.json({ success: true, data: pending });
});

router.get('/:id/schedule', async (req, res) => {
  const { id } = req.params;
  const loan = await prisma.loan.findUnique({ where: { id }, include: { scheduleEntries: true } });
  if (!loan || (!canViewAllBranches(req.user) && loan.branchId !== req.user.branchId)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan not found' } });
  }
  res.json({ success: true, data: loan.scheduleEntries });
});

router.get('/overdue', async (req, res) => {
  const { branchId } = req.query;
  const loans = await prisma.loan.findMany({
    where: {
      ...branchScopedWhere(req.user, branchId),
      status: 'Active',
      scheduleEntries: {
        some: {
          dueDate: { lt: new Date() },
          status: { not: 'Paid' },
        },
      },
    },
    include: { customer: true, loanProduct: true, branch: true, scheduleEntries: true },
  });

  const overdueLoans = loans.map((loan) => {
    const overdueEntry = loan.scheduleEntries
      .filter((entry) => new Date(entry.dueDate) < new Date() && entry.amountPaid < entry.totalDue)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    const daysPastDue = overdueEntry ? Math.floor((new Date() - new Date(overdueEntry.dueDate)) / 86400000) : 0;
    return {
      ...loan,
      overdueDays: daysPastDue,
      overdueAmount: overdueEntry ? overdueEntry.totalDue - overdueEntry.amountPaid : 0,
    };
  });

  res.json({ success: true, data: overdueLoans });
});

router.post('/:id/disburse', authorize({ permissions: ['canPostPayments', 'canApproveLoans'] }), async (req, res) => {
  const { id } = req.params;
  const { disbursementDate, amount, method, referenceNumber } = req.body;
  const application = await prisma.loanApplication.findUnique({ where: { id } });
  if (!application || application.branchId !== resolveBranchId(req.user, application.branchId)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan application not found' } });
  }
  if (application.status !== 'Approved') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Loan application must be approved before disbursement' } });
  }

  const disburseDate = disbursementDate ? new Date(disbursementDate) : new Date();
  const principal = application.requestedAmount;
  const interestRate = application.interestRate;
  const tenorMonths = application.requestedTenorMonths;
  const frequency = application.requestedFrequency;
  const schedule = buildSchedule(disburseDate, principal, interestRate, tenorMonths, frequency);

  const loan = await prisma.loan.create({
    data: {
      loanNumber: `LOAN-${Date.now()}`,
      loanApplicationId: application.id,
      customerId: application.customerId,
      branchId: application.branchId,
      loanProductId: application.loanProductId,
      principalAmount: principal,
      disbursedAmount: parseFloat(amount) || principal,
      disbursementDate: disburseDate,
      maturityDate: new Date(new Date(disburseDate).setMonth(new Date(disburseDate).getMonth() + tenorMonths)),
      interestRate,
      repaymentFrequency: frequency,
      status: 'Active',
      outstandingPrincipal: principal,
      outstandingInterest: parseFloat((principal * (interestRate / 100) * (tenorMonths / 12)).toFixed(2)),
      outstandingFees: application.processingFee,
      outstandingPenalties: 0,
      scheduleEntries: {
        create: schedule,
      },
    },
    include: { scheduleEntries: true },
  });

  await prisma.loanApplication.update({ where: { id }, data: { status: 'Disbursed' } });
  await createAuditLog({ userId: req.user.id, branchId: application.branchId, entityType: 'Loan', entityId: loan.id, action: 'DisbursedLoan', details: { disbursementDate: disburseDate, disbursedAmount: loan.disbursedAmount, method, referenceNumber } });
  await queueNotification({
    eventType: 'Disbursement',
    customer: await prisma.customer.findUnique({ where: { id: application.customerId } }),
    user: req.user,
    branchId: application.branchId,
    messageOverride: `Loan ${loan.loanNumber} has been disbursed for ${loan.disbursedAmount}.`,
    reference: loan.loanNumber,
  });
  return res.status(201).json({ success: true, data: loan });
});

router.get('/:id/payments', authorize({ permissions: ['canPostPayments', 'canApproveLoans'], roles: ['Super Admin', 'Director', 'CEO / Managing Director', 'Auditor', 'Branch Manager'] }), async (req, res) => {
  const { id } = req.params;
  const loan = await prisma.loan.findUnique({ where: { id }, include: { payments: true } });
  if (!loan || (!canViewAllBranches(req.user) && loan.branchId !== req.user.branchId)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan not found' } });
  }
  res.json({ success: true, data: loan.payments });
});

router.post('/:id/payments', authorize({ permissions: ['canPostPayments'] }), async (req, res) => {
  const { id } = req.params;
  const { paymentDate, amount, method, referenceNumber } = req.body;
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan || loan.branchId !== resolveBranchId(req.user, loan.branchId)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan not found' } });
  }
  if (loan.status !== 'Active') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Payments can only be posted against active loans' } });
  }

  const paymentAmount = parseFloat(amount);
  if (!paymentAmount || paymentAmount <= 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Payment amount must be a positive number' } });
  }

  let remaining = paymentAmount;
  const feesPaid = Math.min(loan.outstandingFees, remaining);
  remaining -= feesPaid;
  const penaltiesPaid = Math.min(loan.outstandingPenalties, remaining);
  remaining -= penaltiesPaid;
  const interestPaid = Math.min(loan.outstandingInterest, remaining);
  remaining -= interestPaid;
  const principalPaid = Math.min(loan.outstandingPrincipal, remaining);
  remaining -= principalPaid;

  const schedulePaymentAmount = principalPaid + interestPaid;
  const scheduleEntries = await prisma.loanRepaymentSchedule.findMany({ where: { loanId: id }, orderBy: { dueDate: 'asc' } });
  const { updates } = allocatePaymentToSchedule(schedulePaymentAmount, scheduleEntries);

  const updatedLoan = await prisma.$transaction(async (tx) => {
    const payment = await tx.loanPayment.create({
      data: {
        loanId: id,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        amount: paymentAmount,
        method,
        referenceNumber,
        postedById: req.user.id,
        branchId: loan.branchId,
        principalPaid,
        interestPaid,
        feesPaid,
        penaltiesPaid,
        overpaymentAmount: remaining > 0 ? remaining : 0,
        receiptNumber: `RCT-${Date.now()}`,
      },
    });

    const scheduleUpdates = updates.map((entry) =>
      tx.loanRepaymentSchedule.update({
        where: { id: entry.id },
        data: { amountPaid: entry.amountPaid, status: entry.status },
      }),
    );

    const loanUpdate = tx.loan.update({
      where: { id },
      data: {
        outstandingFees: loan.outstandingFees - feesPaid,
        outstandingPenalties: loan.outstandingPenalties - penaltiesPaid,
        outstandingInterest: loan.outstandingInterest - interestPaid,
        outstandingPrincipal: loan.outstandingPrincipal - principalPaid,
        status: loan.outstandingPrincipal - principalPaid <= 0 ? 'Closed' : loan.status,
      },
      include: { payments: true },
    });

    const [updated, ...updatedSchedules] = await Promise.all([loanUpdate, ...scheduleUpdates]);
    return updated;
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: loan.branchId,
    entityType: 'Loan',
    entityId: loan.id,
    action: 'PostedPayment',
    details: { paymentAmount, principalPaid, interestPaid, feesPaid, penaltiesPaid, overpaymentAmount: remaining > 0 ? remaining : 0 },
  });

  await queueNotification({
    eventType: 'PaymentReceived',
    customer: await prisma.customer.findUnique({ where: { id: loan.customerId } }),
    user: req.user,
    branchId: loan.branchId,
    messageOverride: `Payment of ${paymentAmount.toFixed(2)} received for loan ${loan.loanNumber}.`,
    reference: loan.loanNumber,
  });

  res.status(201).json({ success: true, data: updatedLoan });
});

module.exports = router;
