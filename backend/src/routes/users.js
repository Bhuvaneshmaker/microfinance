const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { createAuditLog } = require('../helpers');

const router = express.Router();
router.use(auth);

router.get('/', authorize({ permissions: ['canManageUsers'] }), async (req, res) => {
  const users = await prisma.user.findMany({ include: { role: true, branch: true }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: users });
});

router.get('/roles', async (req, res) => {
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
  res.json({ success: true, data: roles });
});

router.post('/', authorize({ permissions: ['canManageUsers'] }), async (req, res) => {
  const { username, email, fullName, password, roleId, branchId, status } = req.body;
  if (!username || !email || !fullName || !password || !roleId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'username, email, fullName, password and roleId are required' } });
  }

  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (existing?.username === username) {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Username already exists' } });
  }
  if (existing?.email === email) {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Email already exists' } });
  }

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } });
  }

  const branch = branchId
    ? await prisma.branch.findUnique({ where: { id: branchId } })
    : req.user.branchId
      ? await prisma.branch.findUnique({ where: { id: req.user.branchId } })
      : null;
  if (!branch) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Branch not found' } });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      fullName,
      passwordHash,
      roleId,
      branchId: branch.id,
      status: status || 'Active',
    },
    include: { role: true, branch: true },
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: user.branchId,
    entityType: 'User',
    entityId: user.id,
    action: 'CreatedUser',
    details: { username: user.username, role: user.role.name, status: user.status },
  });

  res.status(201).json({ success: true, data: user });
});

router.patch('/:id', authorize({ permissions: ['canManageUsers'] }), async (req, res) => {
  const { id } = req.params;
  const { email, fullName, password, roleId, branchId, status } = req.body;

  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true, branch: true } });
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  if (email && email !== existing.email) {
    const emailOwner = await prisma.user.findUnique({ where: { email } });
    if (emailOwner) {
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Email already exists' } });
    }
  }

  if (roleId) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } });
    }
  }

  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Branch not found' } });
    }
  }

  const data = {
    email: email || existing.email,
    fullName: fullName || existing.fullName,
    roleId: roleId || existing.roleId,
    branchId: branchId || existing.branchId,
    status: status || existing.status,
  };

  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    include: { role: true, branch: true },
  });

  await createAuditLog({
    userId: req.user.id,
    branchId: updated.branchId,
    entityType: 'User',
    entityId: updated.id,
    action: 'UpdatedUser',
    details: { username: updated.username, role: updated.role.name, status: updated.status },
  });

  res.json({ success: true, data: updated });
});

module.exports = router;
