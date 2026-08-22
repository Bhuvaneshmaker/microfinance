const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [superAdminRole, directorRole, ceoRole, creditOfficerRole, cashierRole, accountantRole, recoveryRole, auditorRole, branchManagerRole, customerServiceRole] = await Promise.all([
    prisma.role.upsert({ where: { name: 'Super Admin' }, update: {}, create: { name: 'Super Admin', description: 'System administrator', canManageUsers: true, canApproveLoans: true, canPostPayments: true, canViewAudit: true } }),
    prisma.role.upsert({ where: { name: 'Director' }, update: {}, create: { name: 'Director', description: 'Approvals and reporting', canManageUsers: false, canApproveLoans: true, canPostPayments: false, canViewAudit: true } }),
    prisma.role.upsert({ where: { name: 'CEO / Managing Director' }, update: {}, create: { name: 'CEO / Managing Director', description: 'Executive portfolio oversight and high-value approvals', canManageUsers: false, canApproveLoans: true, canPostPayments: false, canViewAudit: true } }),
    prisma.role.upsert({ where: { name: 'Credit Officer' }, update: {}, create: { name: 'Credit Officer', description: 'Customer registration and loan capture', canManageUsers: false, canApproveLoans: false, canPostPayments: false, canViewAudit: false } }),
    prisma.role.upsert({ where: { name: 'Cashier' }, update: {}, create: { name: 'Cashier', description: 'Repayment and disbursement entry', canManageUsers: false, canApproveLoans: false, canPostPayments: true, canViewAudit: false } }),
    prisma.role.upsert({ where: { name: 'Accountant' }, update: {}, create: { name: 'Accountant', description: 'Financial recording', canManageUsers: false, canApproveLoans: false, canPostPayments: false, canViewAudit: false } }),
    prisma.role.upsert({ where: { name: 'Recovery Officer' }, update: {}, create: { name: 'Recovery Officer', description: 'Overdue and recovery tracking', canManageUsers: false, canApproveLoans: false, canPostPayments: false, canViewAudit: false } }),
    prisma.role.upsert({ where: { name: 'Auditor' }, update: {}, create: { name: 'Auditor', description: 'Audit viewing only', canManageUsers: false, canApproveLoans: false, canPostPayments: false, canViewAudit: true } }),
    prisma.role.upsert({ where: { name: 'Branch Manager' }, update: {}, create: { name: 'Branch Manager', description: 'Branch operations and oversight', canManageUsers: false, canApproveLoans: true, canPostPayments: false, canViewAudit: true } }),
    prisma.role.upsert({ where: { name: 'Customer Service Officer' }, update: {}, create: { name: 'Customer Service Officer', description: 'Customer inquiry and non-financial profile support', canManageUsers: false, canApproveLoans: false, canPostPayments: false, canViewAudit: false } }),
  ]);

  const branch = await prisma.branch.upsert({
    where: { code: 'HQ' },
    update: {},
    create: { code: 'HQ', name: 'Head Office', location: 'Main Branch' },
  });

  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const users = [
    {
      username: 'admin',
      email: 'admin@microfinance.local',
      fullName: 'System Administrator',
      roleId: superAdminRole.id,
    },
    {
      username: 'director',
      email: 'director@microfinance.local',
      fullName: 'Executive Director',
      roleId: directorRole.id,
    },
    {
      username: 'ceo',
      email: 'ceo@microfinance.local',
      fullName: 'Managing Director',
      roleId: ceoRole.id,
    },
    {
      username: 'branchmanager',
      email: 'branchmanager@microfinance.local',
      fullName: 'Branch Manager',
      roleId: branchManagerRole.id,
    },
    {
      username: 'creditofficer',
      email: 'creditofficer@microfinance.local',
      fullName: 'Credit Officer',
      roleId: creditOfficerRole.id,
    },
    {
      username: 'cashier',
      email: 'cashier@microfinance.local',
      fullName: 'Branch Cashier',
      roleId: cashierRole.id,
    },
    {
      username: 'accountant',
      email: 'accountant@microfinance.local',
      fullName: 'Branch Accountant',
      roleId: accountantRole.id,
    },
    {
      username: 'recovery',
      email: 'recovery@microfinance.local',
      fullName: 'Recovery Officer',
      roleId: recoveryRole.id,
    },
    {
      username: 'auditor',
      email: 'auditor@microfinance.local',
      fullName: 'Internal Auditor',
      roleId: auditorRole.id,
    },
    {
      username: 'customerservice',
      email: 'customerservice@microfinance.local',
      fullName: 'Customer Service Officer',
      roleId: customerServiceRole.id,
    },
  ];

  for (const userData of users) {
    await prisma.user.upsert({
      where: { username: userData.username },
      update: {},
      create: {
        username: userData.username,
        email: userData.email,
        passwordHash,
        fullName: userData.fullName,
        roleId: userData.roleId,
        branchId: branch.id,
        status: 'Active',
      },
    });
  }

  await prisma.customer.upsert({
    where: { customerId: 'CUST-001' },
    update: {},
    create: {
      customerId: 'CUST-001',
      branchId: branch.id,
      firstName: 'Alice',
      lastName: 'Mwangi',
      phone: '+254700000001',
      email: 'alice.mwangi@example.com',
      address: '123 Market Street',
      employmentType: 'Self-employed',
      businessName: 'Mwangi Groceries',
      incomeSource: 'Retail Sales',
      status: 'Active',
    },
  });

  const loanProduct = await prisma.loanProduct.upsert({
    where: { name: 'Standard Microloan' },
    update: {},
    create: {
      name: 'Standard Microloan',
      description: 'Short-term loan for working capital',
      branchId: branch.id,
      interestRate: 18.0,
      interestType: 'Flat',
      repaymentFrequency: 'Monthly',
      minTenorMonths: 3,
      maxTenorMonths: 12,
      minAmount: 5000,
      maxAmount: 200000,
      processingFeePercent: 1.5,
      processingFeeFixed: 500,
      lateFeeRule: '2% per month overdue',
      gracePeriodDays: 5,
      lateFeeAmount: 200,
      approvalThreshold: 100000,
    },
  });

  const creditOfficer = await prisma.user.findUnique({ where: { username: 'creditofficer' } });
  const directorUser = await prisma.user.findUnique({ where: { username: 'director' } });
  const alice = await prisma.customer.findUnique({ where: { customerId: 'CUST-001' } });
  const notificationTemplates = [
    ['template-customer-registration', 'DefaultCustomerRegistration', 'CustomerRegistration', 'Hello {customerName}, your customer profile has been registered.'],
    ['template-loan-approval', 'DefaultLoanApproval', 'LoanApproval', 'Hello {customerName}, your loan application {reference} has been approved.'],
    ['template-loan-rejection', 'DefaultLoanRejection', 'LoanRejection', 'Hello {customerName}, your loan application {reference} was not approved. Please contact your branch.'],
    ['template-disbursement', 'DefaultDisbursement', 'Disbursement', 'Hello {customerName}, loan {reference} has been disbursed.'],
    ['template-payment-received', 'DefaultPaymentReceived', 'PaymentReceived', 'Hello {customerName}, payment for loan {reference} has been received. Thank you.'],
    ['template-payment-reminder', 'DefaultPaymentReminder', 'PaymentReminder', 'Hello {customerName}, your payment for loan {reference} is due soon.'],
    ['template-overdue-notice', 'DefaultOverdueNotice', 'OverdueNotice', 'Hello {customerName}, loan {reference} has an overdue payment. Please contact your branch.'],
    ['template-password-reset', 'DefaultPasswordReset', 'PasswordReset', 'Your account password reset request has been received.'],
    ['template-account-notice', 'DefaultAccountNotice', 'AccountNotice', 'Your account notice: {reference}'],
  ];

  for (const [id, name, eventType, templateBody] of notificationTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { id },
      update: { name, eventType, templateBody, enabled: true },
      create: { id, name, eventType, templateBody, enabled: true },
    });
  }
 
  if (creditOfficer && alice) {
    const approvedApplication = await prisma.loanApplication.upsert({
      where: { applicationNumber: 'APP-1001' },
      update: {},
      create: {
        applicationNumber: 'APP-1001',
        customerId: alice.id,
        branchId: branch.id,
        loanProductId: loanProduct.id,
        requestedAmount: 50000,
        requestedTenorMonths: 6,
        requestedFrequency: 'Monthly',
        interestRate: 18,
        processingFee: 750,
        purpose: 'Working capital stock purchase',
        createdById: creditOfficer.id,
        status: 'Approved',
        submittedAt: new Date(),
        approvedAt: new Date(),
      },
    });

    await prisma.approvalRecord.upsert({
      where: { id: 'approval-app-1001' },
      update: {},
      create: {
        id: 'approval-app-1001',
        loanApplicationId: approvedApplication.id,
        approverId: directorUser ? directorUser.id : creditOfficer.id,
        decision: 'Approved',
        comment: 'Seeded approved application',
        authorityLevel: 'Director',
      },
    });
  }

  console.log('Seed data created successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
