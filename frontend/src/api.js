import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('microfinance_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function unwrapResponse(response) {
  if (response.data && response.data.data !== undefined) {
    return response.data.data;
  }
  return response.data;
}

export async function loginRequest(credentials) {
  const response = await api.post('/auth/login', credentials);
  return unwrapResponse(response);
}

export async function refreshSession() {
  const response = await api.get('/auth/refresh');
  return unwrapResponse(response);
}

export async function fetchCustomers(search, params = {}) {
  const response = await api.get('/customers', { params: { ...params, search } });
  return unwrapResponse(response);
}

export async function fetchCustomerById(id) {
  const response = await api.get(`/customers/${id}`);
  return unwrapResponse(response);
}

export async function createCustomer(payload) {
  const response = await api.post('/customers', payload);
  return unwrapResponse(response);
}

export async function fetchLoanProducts(params) {
  const response = await api.get('/loan-products', { params });
  return unwrapResponse(response);
}

export async function createLoanProduct(payload) {
  const response = await api.post('/loan-products', payload);
  return unwrapResponse(response);
}

export async function fetchUsers() {
  const response = await api.get('/users');
  return unwrapResponse(response);
}

export async function fetchRoles() {
  const response = await api.get('/users/roles');
  return unwrapResponse(response);
}

export async function createUser(payload) {
  const response = await api.post('/users', payload);
  return unwrapResponse(response);
}

export async function updateUser(id, payload) {
  const response = await api.patch(`/users/${id}`, payload);
  return unwrapResponse(response);
}

export async function fetchBranches(params) {
  const response = await api.get('/branches', { params });
  return unwrapResponse(response);
}

export async function updateBranch(id, payload) {
  const response = await api.patch(`/branches/${id}`, payload);
  return unwrapResponse(response);
}

export async function fetchDashboardSummary(params) {
  const response = await api.get('/dashboard/summary', { params });
  return unwrapResponse(response);
}

export async function fetchReportSummary(params) {
  const response = await api.get('/reports/summary', { params });
  return unwrapResponse(response);
}

export async function fetchLoans(params) {
  const response = await api.get('/loans', { params });
  return unwrapResponse(response);
}

export async function fetchOverdueLoans(params) {
  const response = await api.get('/loans/overdue', { params });
  return unwrapResponse(response);
}

export async function fetchLoanSchedule(loanId) {
  const response = await api.get(`/loans/${loanId}/schedule`);
  return unwrapResponse(response);
}

export async function fetchLoanPayments(loanId) {
  const response = await api.get(`/loans/${loanId}/payments`);
  return unwrapResponse(response);
}

export async function fetchPendingDisbursements(params) {
  const response = await api.get('/loans/pending-disbursement', { params });
  return unwrapResponse(response);
}

export async function disburseLoan(id, payload) {
  const response = await api.post(`/loans/${id}/disburse`, payload);
  return unwrapResponse(response);
}

export async function postLoanPayment(id, payload) {
  const response = await api.post(`/loans/${id}/payments`, payload);
  return unwrapResponse(response);
}

export async function fetchLoanApplications(params) {
  const response = await api.get('/loan-applications', { params });
  return unwrapResponse(response);
}

export async function createLoanApplication(payload) {
  const response = await api.post('/loan-applications', payload);
  return unwrapResponse(response);
}

export async function submitLoanApplication(id) {
  const response = await api.post(`/loan-applications/${id}/submit`);
  return unwrapResponse(response);
}

export async function approveLoanApplication(id, comment) {
  const response = await api.post(`/loan-applications/${id}/approve`, { comment });
  return unwrapResponse(response);
}

export async function rejectLoanApplication(id, comment) {
  const response = await api.post(`/loan-applications/${id}/reject`, { comment });
  return unwrapResponse(response);
}

export async function returnLoanApplication(id, comment) {
  const response = await api.post(`/loan-applications/${id}/return`, { comment });
  return unwrapResponse(response);
}

export async function fetchIncomeRecords(params) {
  const response = await api.get('/income-records', { params });
  return unwrapResponse(response);
}

export async function createIncomeRecord(payload) {
  const response = await api.post('/income-records', payload);
  return unwrapResponse(response);
}

export async function fetchExpenseRecords(params) {
  const response = await api.get('/expense-records', { params });
  return unwrapResponse(response);
}

export async function createExpenseRecord(payload) {
  const response = await api.post('/expense-records', payload);
  return unwrapResponse(response);
}

export async function createBranch(payload) {
  const response = await api.post('/branches', payload);
  return unwrapResponse(response);
}

export async function fetchAuditLogs(params) {
  const response = await api.get('/audit-logs', { params });
  return unwrapResponse(response);
}

export async function fetchNotifications(params) {
  const response = await api.get('/notifications', { params });
  return unwrapResponse(response);
}

export async function fetchNotificationTemplates() {
  const response = await api.get('/notifications/templates');
  return unwrapResponse(response);
}

export async function createNotificationTemplate(payload) {
  const response = await api.post('/notifications/templates', payload);
  return unwrapResponse(response);
}

export async function updateNotificationTemplate(id, payload) {
  const response = await api.patch(`/notifications/templates/${id}`, payload);
  return unwrapResponse(response);
}

export async function queueManualNotification(payload) {
  const response = await api.post('/notifications/manual', payload);
  return unwrapResponse(response);
}

export async function fetchRecoveryActions(loanId) {
  const response = await api.get(`/recovery/loans/${loanId}`);
  return unwrapResponse(response);
}

export async function createRecoveryAction(payload) {
  const response = await api.post('/recovery', payload);
  return unwrapResponse(response);
}

export default api;
