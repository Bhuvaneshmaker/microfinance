import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import LoanProducts from './pages/LoanProducts';
import LoanApplications from './pages/LoanApplications';
import Loans from './pages/Loans';
import Reports from './pages/Reports';
import IncomeExpense from './pages/IncomeExpense';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';
import Recovery from './pages/Recovery';
import Branches from './pages/Branches';
import CustomerDetails from './pages/CustomerDetails';
import Notifications from './pages/Notifications';
import Layout from './components/Layout';
import { AuthProvider, useAuthContext } from './context/AuthContext';

function AppRoutes() {
  const { user } = useAuthContext();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetails />} />
        <Route path="loan-products" element={<LoanProducts />} />
        <Route path="loan-applications" element={<LoanApplications />} />
        <Route path="loans" element={<Loans />} />
        <Route path="branches" element={<Branches />} />
        <Route path="recovery" element={<Recovery />} />
        <Route path="reports" element={<Reports />} />
        <Route path="income-expense" element={<IncomeExpense />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="users" element={<Users />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
