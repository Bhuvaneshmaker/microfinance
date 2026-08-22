import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBranches, fetchDashboardSummary } from '../api';
import { useAuthContext } from '../context/AuthContext';
import { canViewAllBranches, formatMoney } from '../utils';

export default function Dashboard() {
  const { user } = useAuthContext();
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    activeLoans: 0,
    pendingApplications: 0,
    disbursedLoans: 0,
    overdueLoans: 0,
    totalRepayments: 0,
    totalIncome: 0,
    totalExpenses: 0,
    outstandingPortfolioBalance: 0,
    branchPerformance: [],
  });
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState(null);

  const loadSummary = async () => {
    try {
      const response = await fetchDashboardSummary(branchId ? { branchId } : undefined);
      setSummary(response);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard summary');
    }
  };

  useEffect(() => {
    loadSummary();
  }, [branchId]);

  useEffect(() => {
    if (!canViewAllBranches(user)) return;
    async function loadBranches() {
      try {
        const response = await fetchBranches();
        setBranches(response);
      } catch (err) {
        setError('Failed to load branches');
      }
    }
    loadBranches();
  }, [user]);

  return (
    <div>
      <h1>Dashboard</h1>
      {canViewAllBranches(user) && (
        <div className="table-toolbar">
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <button className="btn btn-secondary" type="button" onClick={loadSummary}>Refresh</button>
        </div>
      )}
      <div className="grid-col-3">
        <div className="card">
          <h3>Total Customers</h3>
          <strong>{summary.totalCustomers}</strong>
        </div>
        <div className="card">
          <h3>Active Loans</h3>
          <strong>{summary.activeLoans}</strong>
        </div>
        <div className="card">
          <h3>Pending Applications</h3>
          <strong>{summary.pendingApplications}</strong>
        </div>
      </div>
      <div className="grid-col-3" style={{ marginTop: '16px' }}>
        <div className="card">
          <h3>Disbursed Loans</h3>
          <strong>{summary.disbursedLoans}</strong>
        </div>
        <div className="card">
          <h3>Overdue Loans</h3>
          <strong>{summary.overdueLoans}</strong>
        </div>
        <div className="card">
          <h3>Portfolio Balance</h3>
          <strong>{formatMoney(summary.outstandingPortfolioBalance)}</strong>
        </div>
      </div>
      <div className="grid-col-3" style={{ marginTop: '16px' }}>
        <div className="card">
          <h3>Repayments Received</h3>
          <strong>{formatMoney(summary.totalRepayments)}</strong>
        </div>
        <div className="card">
          <h3>Total Income</h3>
          <strong>{formatMoney(summary.totalIncome)}</strong>
        </div>
        <div className="card">
          <h3>Total Expenses</h3>
          <strong>{formatMoney(summary.totalExpenses)}</strong>
        </div>
      </div>
      {user?.role?.name === 'Branch Manager' && (
        <div className="card" style={{ marginTop: '16px' }}>
          <h3>Branch Manager Workspace</h3>
          <p>Quick branch metrics and approval shortcuts.</p>
          <p><strong>Pending applications:</strong> {summary.pendingApplications}</p>
          <p><strong>Active loans:</strong> {summary.activeLoans}</p>
          <Link to="/loan-applications" className="btn btn-secondary" style={{ marginTop: '8px' }}>
            Review Applications
          </Link>
        </div>
      )}
      <div className="card" style={{ marginTop: '16px' }}>
        <h2>Branch Performance</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Customers</th>
                <th>Active Loans</th>
                <th>Outstanding</th>
                <th>Repayments</th>
                <th>Income</th>
                <th>Expenses</th>
              </tr>
            </thead>
            <tbody>
              {summary.branchPerformance.map((branch) => (
                <tr key={branch.id}>
                  <td>{branch.name}</td>
                  <td>{branch.customers}</td>
                  <td>{branch.activeLoans}</td>
                  <td>{formatMoney(branch.outstandingPortfolio)}</td>
                  <td>{formatMoney(branch.repayments)}</td>
                  <td>{formatMoney(branch.income)}</td>
                  <td>{formatMoney(branch.expenses)}</td>
                </tr>
              ))}
              {summary.branchPerformance.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>No branch performance data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
