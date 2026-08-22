const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { branchScopedWhere, createAuditLog, createNotification, resolveBranchId } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const { branchId, status, eventType } = req.query;
  const where = branchScopedWhere(req.user, branchId);
  if (status) {
    where.status = status;
  }
  if (eventType) {
    where.eventType = eventType;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { branch: true, customer: true, user: true, template: true },
  });

  res.json({ success: true, data: notifications });
});

router.get('/templates', async (req, res) => {
  const templates = await prisma.notificationTemplate.findMany({
    orderBy: [{ eventType: 'asc' }, { name: 'asc' }],
  });
  res.json({ success: true, data: templates });
});

router.post('/templates', authorize({ permissions: ['canManageUsers'] }), async (req, res) => {
  const { name, eventType, templateBody, enabled } = req.body;
  if (!name || !eventType || !templateBody) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name, eventType and templateBody are required' } });
  }

  const template = await prisma.notificationTemplate.create({
    data: {
      name,
      eventType,
      templateBody,
      enabled: enabled !== false,
    },
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: req.user.branchId,
    entityType: 'NotificationTemplate',
    entityId: template.id,
    action: 'CreatedNotificationTemplate',
    details: { name: template.name, eventType: template.eventType, enabled: template.enabled },
  });

  res.status(201).json({ success: true, data: template });
});

router.patch('/templates/:id', authorize({ permissions: ['canManageUsers'] }), async (req, res) => {
  const { id } = req.params;
  const { name, eventType, templateBody, enabled } = req.body;

  const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
  }

  const template = await prisma.notificationTemplate.update({
    where: { id },
    data: {
      name: name || existing.name,
      eventType: eventType || existing.eventType,
      templateBody: templateBody || existing.templateBody,
      enabled: typeof enabled === 'boolean' ? enabled : existing.enabled,
    },
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: req.user.branchId,
    entityType: 'NotificationTemplate',
    entityId: template.id,
    action: 'UpdatedNotificationTemplate',
    details: { name: template.name, eventType: template.eventType, enabled: template.enabled },
  });

  res.json({ success: true, data: template });
});

router.post('/manual', authorize({ permissions: ['canManageUsers'] }), async (req, res) => {
  const { eventType, targetPhone, message, branchId } = req.body;
  if (!eventType || !targetPhone || !message) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'eventType, targetPhone and message are required' } });
  }

  const notificationBranchId = resolveBranchId(req.user, branchId);
  const notification = await createNotification({
    userId: req.user.id,
    branchId: notificationBranchId,
    eventType,
    targetPhone,
    message,
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: notificationBranchId,
    entityType: 'Notification',
    entityId: notification.id,
    action: 'QueuedManualNotification',
    details: { eventType, targetPhone },
  });

  res.status(201).json({ success: true, data: notification });
});

module.exports = router;
