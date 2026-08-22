const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
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

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
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

app.listen(port, async () => {
  try {
    await prisma.$connect();
    startNotificationWorker();
    console.log(`Backend server listening on http://localhost:${port}`);
  } catch (error) {
    console.error('Failed to connect to database', error);
  }
});
