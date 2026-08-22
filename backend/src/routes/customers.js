const express = require('express');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const { branchScopedWhere, createAuditLog, queueNotification, resolveBranchId } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const { search, branchId, status } = req.query;
  const where = branchScopedWhere(req.user, branchId);

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { customerId: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { loans: { some: { loanNumber: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  if (status) {
    where.status = status;
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { branch: true },
  });
  res.json({ success: true, data: customers });
});

router.post('/', async (req, res) => {
  const {
    firstName,
    lastName,
    otherNames,
    customerId,
    dateOfBirth,
    gender,
    idType,
    idNumber,
    phone,
    email,
    address,
    employmentType,
    employerName,
    businessName,
    incomeSource,
    status,
    branchId,
    guarantor,
    nextOfKin,
  } = req.body;
  if (!firstName || !lastName || !customerId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'firstName, lastName, and customerId are required' } });
  }

  const existing = await prisma.customer.findUnique({ where: { customerId } });
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Customer ID already exists' } });
  }

  const customerBranchId = resolveBranchId(req.user, branchId);
  const branch = await prisma.branch.findUnique({ where: { id: customerBranchId } });
  if (!branch) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Branch not found' } });
  }

  const customer = await prisma.customer.create({
    data: {
      firstName,
      lastName,
      otherNames,
      customerId,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender,
      idType,
      idNumber,
      phone,
      email,
      address,
      employmentType,
      employerName,
      businessName,
      incomeSource,
      status: status || 'Active',
      branchId: customerBranchId,
      guarantors: guarantor?.name
        ? {
            create: {
              name: guarantor.name,
              relationship: guarantor.relationship || null,
              phone: guarantor.phone || null,
              address: guarantor.address || null,
              idType: guarantor.idType || null,
              idNumber: guarantor.idNumber || null,
            },
          }
        : undefined,
      nextOfKin: nextOfKin?.name
        ? {
            create: {
              name: nextOfKin.name,
              relationship: nextOfKin.relationship || null,
              phone: nextOfKin.phone || null,
              address: nextOfKin.address || null,
            },
          }
        : undefined,
    },
    include: { branch: true, guarantors: true, nextOfKin: true },
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: customerBranchId,
    entityType: 'Customer',
    entityId: customer.id,
    action: 'CreatedCustomer',
    details: { customerId: customer.customerId, fullName: `${customer.firstName} ${customer.lastName}` },
  });

  await queueNotification({
    eventType: 'CustomerRegistration',
    customer,
    user: req.user,
    branchId: customerBranchId,
    messageOverride: `A customer profile has been registered for ${customer.firstName} ${customer.lastName}.`,
  });

  res.status(201).json({ success: true, data: customer });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const customer = await prisma.customer.findFirst({
    where: { id, ...branchScopedWhere(req.user) },
    include: {
      branch: true,
      documents: true,
      guarantors: true,
      nextOfKin: true,
      applications: { include: { loanProduct: true, createdBy: true } },
      loans: {
        include: {
          loanProduct: true,
          payments: true,
          scheduleEntries: true,
        },
      },
    },
  });
  if (!customer) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
  }

  return res.json({ success: true, data: customer });
});

module.exports = router;
