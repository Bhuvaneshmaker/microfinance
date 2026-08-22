const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { branchScopedWhere } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/', authorize({ permissions: ['canViewAudit'] }), async (req, res) => {
  const { branchId, entityType, action } = req.query;
  const where = branchScopedWhere(req.user, branchId);
  if (entityType) {
    where.entityType = entityType;
  }
  if (action) {
    where.action = { contains: action, mode: 'insensitive' };
  }
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: 200,
    include: { user: true, branch: true },
  });
  res.json({ success: true, data: logs });
});

module.exports = router;
