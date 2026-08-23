const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const customersRoutes = require('./routes/customers');
const loanProductsRoutes = require('./routes/loanProducts');
const loanApplicationsRoutes = require('./routes/loanApplications');
const loansRoutes = require('./routes/loans');
const dashboardRoutes = require('./routes/dashboard');
const reportsRoutes = require('./routes/reports');
const notificationsRoutes = require('./routes/notifications');
const usersRoutes = require('./routes/users');
const branchesRoutes = require('./routes/branches');
const auditLogsRoutes = require('./routes/auditLogs');
const incomeRecordsRoutes = require('./routes/incomeRecords');
const expenseRecordsRoutes = require('./routes/expenseRecords');
const { startNotificationWorker } = require('./helpers');
const prisma = require('./prismaClient');

const app = express();
const port = process.env.PORT || 4000;

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://microfinancelive.netlify.app',
  'https://microfinanceapplive.netlify.app',
];

function normalizeOrigin(origin) {
  return origin ? origin.replace(/\/+$/, '') : origin;
}

function parseOrigins(value) {
  return value
    ? value
        .split(',')
        .map((origin) => normalizeOrigin(origin.trim()))
        .filter(Boolean)
    : [];
}

function validateEnvironment() {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  if (['defaultsecret', 'replace_with_secure_secret', 'replace_with_a_secure_random_secret'].includes(process.env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be changed to a secure random value.');
  }
}

const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.CORS_ORIGIN),
]);

app.set('trust proxy', 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has('*') || allowedOrigins.has(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/loan-products', loanProductsRoutes);
app.use('/api/loan-applications', loanApplicationsRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/income-records', incomeRecordsRoutes);
app.use('/api/expense-records', expenseRecordsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
});

async function startServer() {
  try {
    validateEnvironment();
    await prisma.$connect();
    startNotificationWorker();
    app.listen(port, () => {
      console.log(`Backend server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to connect to database', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
