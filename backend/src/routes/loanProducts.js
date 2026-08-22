const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { branchScopedWhere, createAuditLog, resolveBranchId } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const { branchId, status } = req.query;
  const where = branchScopedWhere(req.user, branchId);
  if (status) {
    where.status = status;
  }
  const products = await prisma.loanProduct.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { branch: true },
  });
  res.json({ success: true, data: products });
});

router.post('/', authorize({ permissions: ['canManageUsers'] }), async (req, res) => {
  const { name, description, branchId, interestRate, interestType, repaymentFrequency, minTenorMonths, maxTenorMonths, minAmount, maxAmount, processingFeePercent, processingFeeFixed, lateFeeRule, gracePeriodDays, lateFeeAmount, approvalThreshold, status } = req.body;
  if (!name || interestRate == null || !interestType || !repaymentFrequency) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Required loan product fields are missing' } });
  }

  const existing = await prisma.loanProduct.findUnique({ where: { name } });
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Loan product name already exists' } });
  }

  const productBranchId = resolveBranchId(req.user, branchId);
  const branch = await prisma.branch.findUnique({ where: { id: productBranchId } });
  if (!branch) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Branch not found' } });
  }

  const product = await prisma.loanProduct.create({
    data: {
      name,
      description,
      branchId: productBranchId,
      interestRate: parseFloat(interestRate),
      interestType,
      repaymentFrequency,
      minTenorMonths: Number(minTenorMonths) || 1,
      maxTenorMonths: Number(maxTenorMonths) || 12,
      minAmount: parseFloat(minAmount) || 0,
      maxAmount: parseFloat(maxAmount) || 0,
      processingFeePercent: parseFloat(processingFeePercent) || 0,
      processingFeeFixed: parseFloat(processingFeeFixed) || 0,
      lateFeeRule: lateFeeRule || 'Flat',
      gracePeriodDays: Number(gracePeriodDays) || 0,
      lateFeeAmount: parseFloat(lateFeeAmount) || 0,
      approvalThreshold: parseFloat(approvalThreshold) || 0,
      status: status || 'Active',
    },
    include: { branch: true },
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: productBranchId,
    entityType: 'LoanProduct',
    entityId: product.id,
    action: 'CreatedLoanProduct',
    details: { name: product.name, interestRate: product.interestRate, approvalThreshold: product.approvalThreshold },
  });

  return res.status(201).json({ success: true, data: product });
});

module.exports = router;
