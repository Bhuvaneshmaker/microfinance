const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { branchScopedWhere, canViewAllBranches, createAuditLog, queueNotification, resolveBranchId } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const { status, branchId } = req.query;
  const where = branchScopedWhere(req.user, branchId);
  if (status) {
    where.status = status;
  }

  const applications = await prisma.loanApplication.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { customer: true, loanProduct: true, createdBy: true, branch: true, approvalRecords: { include: { approver: true }, orderBy: { decisionAt: 'desc' } } },
  });
  res.json({ success: true, data: applications });
});

router.post('/', async (req, res) => {
  const { customerId, loanProductId, requestedAmount, requestedTenorMonths, requestedFrequency, interestRate, processingFee, purpose, branchId } = req.body;
  if (!customerId || !loanProductId || !requestedAmount || !requestedTenorMonths || !requestedFrequency) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Required loan application fields are missing' } });
  }

  const applicationBranchId = resolveBranchId(req.user, branchId);
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.branchId !== applicationBranchId) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found for this branch' } });
  }

  const loanProduct = await prisma.loanProduct.findUnique({ where: { id: loanProductId } });
  if (!loanProduct || loanProduct.branchId !== applicationBranchId) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan product not found for this branch' } });
  }

  const amount = parseFloat(requestedAmount);
  const tenorMonths = Number(requestedTenorMonths);
  if (amount < loanProduct.minAmount || amount > loanProduct.maxAmount) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Requested amount must be between ${loanProduct.minAmount} and ${loanProduct.maxAmount}` } });
  }
  if (tenorMonths < loanProduct.minTenorMonths || tenorMonths > loanProduct.maxTenorMonths) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Requested tenor must be between ${loanProduct.minTenorMonths} and ${loanProduct.maxTenorMonths} months` } });
  }

  const application = await prisma.loanApplication.create({
    data: {
      applicationNumber: `APP-${Date.now()}`,
      customerId,
      branchId: applicationBranchId,
      loanProductId,
      requestedAmount: amount,
      requestedTenorMonths: tenorMonths,
      requestedFrequency,
      interestRate: parseFloat(interestRate) || loanProduct.interestRate,
      processingFee: parseFloat(processingFee) || ((amount * loanProduct.processingFeePercent) / 100) + loanProduct.processingFeeFixed,
      purpose,
      createdById: req.user.id,
      status: 'Draft',
    },
    include: { customer: true, loanProduct: true, branch: true, createdBy: true },
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: applicationBranchId,
    entityType: 'LoanApplication',
    entityId: application.id,
    action: 'CreatedApplication',
    details: { applicationNumber: application.applicationNumber, requestedAmount: application.requestedAmount },
  });

  return res.status(201).json({ success: true, data: application });
});

router.post('/:id/submit', async (req, res) => {
  const { id } = req.params;
  const application = await prisma.loanApplication.findUnique({ where: { id }, include: { loanProduct: true } });
  if (!application) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan application not found' } });
  }
  if (!canViewAllBranches(req.user) && application.branchId !== req.user.branchId) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }
  if (application.status !== 'Draft' && application.status !== 'Returned') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Only draft or returned applications can be submitted' } });
  }

  const requiresSeniorReview = application.loanProduct?.approvalThreshold > 0 && application.requestedAmount > application.loanProduct.approvalThreshold;
  const updated = await prisma.loanApplication.update({
    where: { id },
    data: {
      status: requiresSeniorReview ? 'UnderReview' : 'Submitted',
      submittedAt: new Date(),
    },
  });

  await createAuditLog({ userId: req.user.id, branchId: application.branchId, entityType: 'LoanApplication', entityId: id, action: 'SubmittedApplication', details: { status: updated.status } });
  return res.json({ success: true, data: updated });
});

router.post('/:id/approve', authorize({ permissions: ['canApproveLoans'] }), async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  const application = await prisma.loanApplication.findUnique({ where: { id }, include: { customer: true } });
  if (!application) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan application not found' } });
  }
  if (application.branchId !== resolveBranchId(req.user, application.branchId)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }
  if (application.status !== 'Submitted' && application.status !== 'UnderReview') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Only submitted or under review applications can be approved' } });
  }

  const updated = await prisma.loanApplication.update({ where: { id }, data: { status: 'Approved', approvedAt: new Date() } });
  await prisma.approvalRecord.create({ data: { loanApplicationId: id, approverId: req.user.id, decision: 'Approved', comment, authorityLevel: req.user.role.name } });
  await createAuditLog({ userId: req.user.id, branchId: application.branchId, entityType: 'LoanApplication', entityId: id, action: 'ApprovedApplication', details: { comment } });
  await queueNotification({
    eventType: 'LoanApproval',
    customer: application.customer,
    user: req.user,
    branchId: application.branchId,
    messageOverride: `Loan application ${application.applicationNumber} has been approved.`,
    reference: application.applicationNumber,
  });
  return res.json({ success: true, data: updated });
});

router.post('/:id/reject', authorize({ permissions: ['canApproveLoans'] }), async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  const application = await prisma.loanApplication.findUnique({ where: { id }, include: { customer: true } });
  if (!application) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan application not found' } });
  }
  if (application.branchId !== resolveBranchId(req.user, application.branchId)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }
  if (application.status !== 'Submitted' && application.status !== 'UnderReview') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Only submitted or under review applications can be rejected' } });
  }

  const updated = await prisma.loanApplication.update({ where: { id }, data: { status: 'Rejected', rejectedAt: new Date() } });
  await prisma.approvalRecord.create({ data: { loanApplicationId: id, approverId: req.user.id, decision: 'Rejected', comment, authorityLevel: req.user.role.name } });
  await createAuditLog({ userId: req.user.id, branchId: application.branchId, entityType: 'LoanApplication', entityId: id, action: 'RejectedApplication', details: { comment } });
  await queueNotification({
    eventType: 'LoanRejection',
    customer: application.customer,
    user: req.user,
    branchId: application.branchId,
    messageOverride: `Loan application ${application.applicationNumber} has been rejected. ${comment || ''}`,
    reference: application.applicationNumber,
  });
  return res.json({ success: true, data: updated });
});

router.post('/:id/return', authorize({ permissions: ['canApproveLoans'] }), async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  const application = await prisma.loanApplication.findUnique({ where: { id }, include: { customer: true } });
  if (!application) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan application not found' } });
  }
  if (application.branchId !== resolveBranchId(req.user, application.branchId)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }
  if (application.status !== 'Submitted' && application.status !== 'UnderReview') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Only submitted or under review applications can be returned for correction' } });
  }

  const updated = await prisma.loanApplication.update({ where: { id }, data: { status: 'Returned' } });
  await prisma.approvalRecord.create({ data: { loanApplicationId: id, approverId: req.user.id, decision: 'Returned', comment, authorityLevel: req.user.role.name } });
  await createAuditLog({ userId: req.user.id, branchId: application.branchId, entityType: 'LoanApplication', entityId: id, action: 'ReturnedApplication', details: { comment } });
  return res.json({ success: true, data: updated });
});

module.exports = router;
