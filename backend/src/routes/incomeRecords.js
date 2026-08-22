const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const { branchScopedWhere, createAuditLog, resolveBranchId } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const { startDate, endDate, branchId, category } = req.query;
  const where = branchScopedWhere(req.user, branchId);
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  if (category) {
    where.category = { contains: category, mode: 'insensitive' };
  }

  const records = await prisma.incomeRecord.findMany({ where, orderBy: { date: 'desc' }, include: { branch: true, recordedBy: true } });
  res.json({ success: true, data: records });
});

router.post('/', async (req, res) => {
  const { category, amount, date, description, referenceNumber, branchId } = req.body;
  const recordAmount = parseFloat(amount);
  if (!category || !recordAmount || recordAmount <= 0 || !date) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'category, amount and date are required and amount must be positive' } });
  }

  const recordBranchId = resolveBranchId(req.user, branchId);
  const record = await prisma.incomeRecord.create({
    data: {
      branchId: recordBranchId,
      recordedById: req.user.id,
      category,
      amount: recordAmount,
      date: new Date(date),
      description,
      referenceNumber,
    },
    include: { branch: true, recordedBy: true },
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: recordBranchId,
    entityType: 'IncomeRecord',
    entityId: record.id,
    action: 'CreatedIncomeRecord',
    details: record,
  });

  res.status(201).json({ success: true, data: record });
});

module.exports = router;
