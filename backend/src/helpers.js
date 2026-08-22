const prisma = require('./prismaClient');

const ALL_BRANCH_ROLES = new Set([
  'Super Admin',
  'Director',
  'CEO / Managing Director',
]);

function canViewAllBranches(user) {
  return ALL_BRANCH_ROLES.has(user?.role?.name);
}

function branchScopedWhere(user, branchId = null) {
  if (canViewAllBranches(user)) {
    return branchId ? { branchId } : {};
  }
  return { branchId: user.branchId };
}

function resolveBranchId(user, branchId = null) {
  if (canViewAllBranches(user) && branchId) {
    return branchId;
  }
  return user.branchId;
}

async function createAuditLog({ userId, branchId, entityType, entityId, action, details = {}, ipAddress = null, userAgent = null }) {
  return prisma.auditLog.create({
    data: {
      userId,
      branchId,
      entityType,
      entityId,
      action,
      details,
      ipAddress,
      userAgent,
    },
  });
}

async function createNotification({ customerId = null, userId = null, branchId = null, templateId = null, eventType, targetPhone = '', message, status = 'Pending' }) {
  return prisma.notification.create({
    data: {
      customerId,
      userId,
      branchId,
      templateId,
      eventType,
      targetPhone,
      message,
      status,
    },
  });
}

async function queueNotification({ eventType, customer = null, user = null, branchId = null, messageOverride = null, reference = null }) {
  const template = await prisma.notificationTemplate.findFirst({ where: { eventType, enabled: true } });
  const targetPhone = customer?.phone || '';
  if (!targetPhone) {
    return null;
  }
  const message = messageOverride || (template ? template.templateBody.replace('{customerName}', `${customer.firstName} ${customer.lastName}`).replace('{reference}', reference || '') : `Notification: ${eventType}`);
  return createNotification({
    customerId: customer?.id || null,
    userId: user?.id || null,
    branchId,
    templateId: template?.id || null,
    eventType,
    targetPhone,
    message,
  });
}

async function sendSmsNotification(notification) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    console.log('[SMS Worker] no provider configured, marking notification as sent:', {
      id: notification.id,
      to: notification.targetPhone,
      message: notification.message,
    });
    return { status: 'Sent' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    From: fromNumber,
    To: notification.targetPhone,
    Body: notification.message,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SMS send failed: ${response.status} ${errorText}`);
  }

  return { status: 'Sent' };
}

async function processPendingNotifications() {
  const notifications = await prisma.notification.findMany({ where: { status: 'Pending' }, take: 20, orderBy: { createdAt: 'asc' } });
  for (const notification of notifications) {
    try {
      const result = await sendSmsNotification(notification);
      await prisma.notification.update({ where: { id: notification.id }, data: { status: result.status, sentAt: new Date() } });
    } catch (error) {
      console.error('[SMS Worker] failed to send notification', notification.id, error.message);
      await prisma.notification.update({ where: { id: notification.id }, data: { status: 'Failed' } });
    }
  }
}

function startNotificationWorker() {
  console.log('[SMS Worker] starting notification worker');
  setInterval(() => {
    processPendingNotifications().catch((error) => console.error('[SMS Worker] error processing pending notifications', error));
  }, 15000);
}

module.exports = {
  branchScopedWhere,
  canViewAllBranches,
  createAuditLog,
  createNotification,
  queueNotification,
  resolveBranchId,
  startNotificationWorker,
};
