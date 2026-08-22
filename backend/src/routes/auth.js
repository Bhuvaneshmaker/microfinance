const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const auth = require('../middleware/auth');
const { createAuditLog } = require('../helpers');

const router = express.Router();

/**
 * Login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username and password are required',
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        role: true,
        branch: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      });
    }

    // Generate JWT Token
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role.name,
        branchId: user.branchId,
      },
      process.env.JWT_SECRET || 'defaultsecret',
      {
        expiresIn: '12h',
      }
    );

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // Audit log
    await createAuditLog({
      userId: user.id,
      branchId: user.branchId,
      entityType: 'User',
      entityId: user.id,
      action: 'UserLoggedIn',
      details: {
        username,
      },
    });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: {
            name: user.role.name,
            canManageUsers: user.role.canManageUsers,
            canApproveLoans: user.role.canApproveLoans,
            canPostPayments: user.role.canPostPayments,
            canViewAudit: user.role.canViewAudit,
          },
          branch: user.branch
            ? {
                id: user.branch.id,
                name: user.branch.name,
              }
            : null,
        },
      },
    });
  } catch (error) {
    console.error('Login Error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message,
      },
    });
  }
});

/**
 * Refresh User Details
 */
router.get('/refresh', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      include: {
        role: true,
        branch: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found',
        },
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role.name,
        branchId: user.branchId,
      },
      process.env.JWT_SECRET || 'defaultsecret',
      {
        expiresIn: '12h',
      }
    );

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: {
            name: user.role.name,
            canManageUsers: user.role.canManageUsers,
            canApproveLoans: user.role.canApproveLoans,
            canPostPayments: user.role.canPostPayments,
            canViewAudit: user.role.canViewAudit,
          },
          branch: user.branch
            ? {
                id: user.branch.id,
                name: user.branch.name,
              }
            : null,
        },
      },
    });
  } catch (error) {
    console.error('Refresh Error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message,
      },
    });
  }
});

module.exports = router;