const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { canViewAllBranches, createAuditLog, resolveBranchId } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/loans/:loanId', async (req, res) => {
  const { loanId } = req.params;
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || (!canViewAllBranches(req.user) && loan.branchId !== req.user.branchId)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan not found' } });
  }
  const actions = await prisma.recoveryAction.findMany({
    where: { loanId },
    include: { recoveryOfficer: true },
    orderBy: { actionDate: 'desc' }
  });
  res.json({ success: true, data: actions });
});

router.post('/', authorize({ roles: ['Super Admin', 'Recovery Officer', 'Branch Manager'] }), async (req, res) => {
  const { loanId, actionType, notes, actionDate, nextFollowUpDate, status } = req.body;

  if (!loanId || !actionType || !notes || !actionDate) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'loanId, actionType, notes, and actionDate are required' }
    });
  }

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || loan.branchId !== resolveBranchId(req.user, loan.branchId)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan not found' } });
  }

  const action = await prisma.recoveryAction.create({
    data: {
      loanId,
      recoveryOfficerId: req.user.id,
      actionType,
      notes,
      actionDate: new Date(actionDate),
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
      status: status || 'Open'
    }
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: loan.branchId,
    entityType: 'RecoveryAction',
    entityId: action.id,
    action: 'CreatedRecoveryAction',
    details: action
  });

  res.status(201).json({ success: true, data: action });
});

module.exports = router;
