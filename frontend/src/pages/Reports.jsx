import { useEffect, useMemo, useState } from 'react';
import { fetchBranches, fetchReportSummary } from '../api';
import { useAuthContext } from '../context/AuthContext';
import { canViewAllBranches, exportCsv, formatDate, formatMoney } from '../utils';

const emptySummary = {
  totalLoanPrincipal: 0,
  totalOutstandingPrincipal: 0,
  totalOutstandingInterest: 0,
  totalOutstandingFees: 0,
  totalOutstandingPenalties: 0,
  totalRepayments: 0,
  totalIncome: 0,
  totalExpenses: 0,
  loans: [],
  applications: [],
  payments: [],
  customers: [],
};

export default function Reports() {
  const { user } = useAuthContext();
  const [summary, setSummary] = useState(emptySummary);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', status: '', branchId: '' });
  const [activeReport, setActiveReport] = useState('loans');
  const [error, setError] = useState(null);

  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), [filters]);

  const loadSummary = async () => {
    try {
      const response = await fetchReportSummary(params);
      setSummary({ ...emptySummary, ...response });
      setError(null);
    } catch (err) {
      setError('Failed to load report summary');
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

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

  const handleFilterChange = (field) => (event) => setFilters({ ...filters, [field]: event.target.value });

  const reportRows = {
    loans: summary.loans.map((loan) => ({
      loanNumber: loan.loanNumber,
      customer: `${loan.customer?.firstName || ''} ${loan.customer?.lastName || ''}`.trim(),
      branch: loan.branch?.name || '',
      product: loan.loanProduct?.name || '',
      status: loan.status,
      principal: loan.principalAmount,
      outstanding: (loan.outstandingPrincipal || 0) + (loan.outstandingInterest || 0) + (loan.outstandingFees || 0) + (loan.outstandingPenalties || 0),
      maturityDate: formatDate(loan.maturityDate),
    })),
    applications: summary.applications.map((application) => ({
      applicationNumber: application.applicationNumber,
      customer: `${application.customer?.firstName || ''} ${application.customer?.lastName || ''}`.trim(),
      branch: application.branch?.name || '',
      product: application.loanProduct?.name || '',
      status: application.status,
      amount: application.requestedAmount,
      tenorMonths: application.requestedTenorMonths,
    })),
    payments: summary.payments.map((payment) => ({
      receiptNumber: payment.receiptNumber,
      loanNumber: payment.loan?.loanNumber || '',
      branch: payment.branch?.name || '',
      amount: payment.amount,
      method: payment.method,
      paymentDate: formatDate(payment.paymentDate),
      postedBy: payment.postedBy?.fullName || '',
    })),
    customers: summary.customers.map((customer) => ({
      customerId: customer.customerId,
      name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
      branch: customer.branch?.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      status: customer.status,
    })),
  };

  const currentRows = reportRows[activeReport] || [];

  return (
    <div>
      <h1>Reports</h1>
      <div className="card">
        <div className="table-toolbar">
          <input type="date" value={filters.startDate} onChange={handleFilterChange('startDate')} />
          <input type="date" value={filters.endDate} onChange={handleFilterChange('endDate')} />
          <select value={filters.status} onChange={handleFilterChange('status')}>
            <option value="">Any loan status</option>
            <option value="Approved">Approved</option>
            <option value="Active">Active</option>
            <option value="Closed">Closed</option>
            <option value="Defaulted">Defaulted</option>
            <option value="WrittenOff">Written Off</option>
          </select>
          {canViewAllBranches(user) && (
            <select value={filters.branchId} onChange={handleFilterChange('branchId')}>
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-secondary" type="button" onClick={loadSummary}>Apply</button>
        </div>
      </div>

      <div className="grid-col-3" style={{ marginTop: '16px' }}>
        <div className="card">
          <h3>Total Loan Principal</h3>
          <strong>{formatMoney(summary.totalLoanPrincipal)}</strong>
        </div>
        <div className="card">
          <h3>Outstanding Principal</h3>
          <strong>{formatMoney(summary.totalOutstandingPrincipal)}</strong>
        </div>
        <div className="card">
          <h3>Outstanding Interest</h3>
          <strong>{formatMoney(summary.totalOutstandingInterest)}</strong>
        </div>
      </div>
      <div className="grid-col-3" style={{ marginTop: '16px' }}>
        <div className="card">
          <h3>Fees Outstanding</h3>
          <strong>{formatMoney(summary.totalOutstandingFees)}</strong>
        </div>
        <div className="card">
          <h3>Penalties Outstanding</h3>
          <strong>{formatMoney(summary.totalOutstandingPenalties)}</strong>
        </div>
        <div className="card">
          <h3>Repayments Collected</h3>
          <strong>{formatMoney(summary.totalRepayments)}</strong>
        </div>
      </div>
      <div className="grid-col-3" style={{ marginTop: '16px' }}>
        <div className="card">
          <h3>Total Income</h3>
          <strong>{formatMoney(summary.totalIncome)}</strong>
        </div>
        <div className="card">
          <h3>Total Expenses</h3>
          <strong>{formatMoney(summary.totalExpenses)}</strong>
        </div>
        <div className="card">
          <h3>Net Position</h3>
          <strong>{formatMoney(summary.totalIncome - summary.totalExpenses)}</strong>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <div className="actions-row" style={{ marginBottom: '16px' }}>
          {['loans', 'applications', 'payments', 'customers'].map((report) => (
            <button
              key={report}
              type="button"
              className={`btn ${activeReport === report ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveReport(report)}
            >
              {report[0].toUpperCase() + report.slice(1)}
            </button>
          ))}
          <button type="button" className="btn btn-secondary" onClick={() => exportCsv(`${activeReport}-report.csv`, currentRows)}>
            Export CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {currentRows[0] ? Object.keys(currentRows[0]).map((header) => <th key={header}>{header}</th>) : <th>Report</th>}
              </tr>
            </thead>
            <tbody>
              {currentRows.map((row, index) => (
                <tr key={`${activeReport}-${index}`}>
                  {Object.values(row).map((value, valueIndex) => (
                    <td key={`${activeReport}-${index}-${valueIndex}`}>{typeof value === 'number' ? formatMoney(value) : value || '-'}</td>
                  ))}
                </tr>
              ))}
              {currentRows.length === 0 && (
                <tr>
                  <td style={{ textAlign: 'center' }}>No report rows found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {error && <div className="form-error" style={{ marginTop: '16px' }}>{error}</div>}
    </div>
  );
}
