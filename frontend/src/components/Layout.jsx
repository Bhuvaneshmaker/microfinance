import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';

export default function Layout() {
  const { logout, user } = useAuthContext();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Microfinance LMS</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/customers">Customers</NavLink>
          <NavLink to="/loan-products">Loan Products</NavLink>
          <NavLink to="/loan-applications">Loan Applications</NavLink>
          <NavLink to="/loans">Loan Management</NavLink>
          <NavLink to="/branches">Branches</NavLink>
          <NavLink to="/recovery">Overdue & Recovery</NavLink>
          <NavLink to="/reports">Reports</NavLink>
          <NavLink to="/income-expense">Income & Expense</NavLink>
          <NavLink to="/notifications">Notifications</NavLink>
          {user?.role?.canViewAudit && <NavLink to="/audit-logs">Audit Logs</NavLink>}
          {user?.role?.canManageUsers && <NavLink to="/users">Users</NavLink>}
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            Welcome, <strong>{user?.fullName || 'User'}</strong> ({user?.role?.name || 'Staff'})
          </div>
          <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
