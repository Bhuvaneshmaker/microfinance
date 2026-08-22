const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { createAuditLog } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const branches = await prisma.branch.findMany({
    where: includeInactive && req.user.role?.canManageUsers ? {} : { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: branches });
});

router.post('/', authorize({ permissions: ['canManageUsers'] }), async (req, res) => {
  const { code, name, location, isActive } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Branch code and name are required' } });
  }

  const existing = await prisma.branch.findUnique({ where: { code } });
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Branch code already exists' } });
  }

  const branch = await prisma.branch.create({
    data: {
      code,
      name,
      location,
      isActive: isActive !== false,
    },
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: req.user.branchId,
    entityType: 'Branch',
    entityId: branch.id,
    action: 'CreatedBranch',
    details: { code: branch.code, name: branch.name, location: branch.location },
  });

  res.status(201).json({ success: true, data: branch });
});

router.patch('/:id', authorize({ permissions: ['canManageUsers'] }), async (req, res) => {
  const { id } = req.params;
  const { code, name, location, isActive } = req.body;

  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Branch not found' } });
  }

  const updated = await prisma.branch.update({
    where: { id },
    data: {
      code: code || branch.code,
      name: name || branch.name,
      location,
      isActive: typeof isActive === 'boolean' ? isActive : branch.isActive,
    },
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: req.user.branchId,
    entityType: 'Branch',
    entityId: updated.id,
    action: 'UpdatedBranch',
    details: { code: updated.code, name: updated.name, isActive: updated.isActive },
  });

  res.json({ success: true, data: updated });
});

module.exports = router;
