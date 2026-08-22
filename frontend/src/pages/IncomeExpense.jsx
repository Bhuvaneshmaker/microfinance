import { useEffect, useState } from 'react';
import { createExpenseRecord, createIncomeRecord, fetchBranches, fetchExpenseRecords, fetchIncomeRecords } from '../api';
import { useAuthContext } from '../context/AuthContext';
import { canViewAllBranches, formatDate, formatMoney } from '../utils';

const emptyForm = { category: '', amount: '', date: '', description: '', referenceNumber: '', branchId: '' };

export default function IncomeExpense() {
  const { user } = useAuthContext();
  const [type, setType] = useState('income');
  const [records, setRecords] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', category: '', branchId: '' });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadRecords = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const response = type === 'income' ? await fetchIncomeRecords(params) : await fetchExpenseRecords(params);
      setRecords(response);
      setError(null);
    } catch (err) {
      setError('Unable to load records');
    }
  };

  useEffect(() => {
    loadRecords();
  }, [type]);

  useEffect(() => {
    if (!canViewAllBranches(user)) return;
    async function loadBranches() {
      try {
        const response = await fetchBranches();
        setBranches(response);
      } catch (err) {
        setError('Unable to load branches');
      }
    }
    loadBranches();
  }, [user]);

  const handleChange = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const handleFilterChange = (field) => (event) => setFilters({ ...filters, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (type === 'income') {
        await createIncomeRecord(form);
      } else {
        await createExpenseRecord(form);
      }
      setSuccess(`${type === 'income' ? 'Income' : 'Expense'} record saved successfully.`);
      setForm(emptyForm);
      loadRecords();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save record');
    }
  };

  return (
    <div>
      <h1>Income and Expense Tracking</h1>
      <div className="card">
        <div className="actions-row" style={{ marginBottom: '16px' }}>
          <button type="button" className={`btn ${type === 'income' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setType('income')}>
            Income
          </button>
          <button type="button" className={`btn ${type === 'expense' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setType('expense')}>
            Expense
          </button>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          {canViewAllBranches(user) && (
            <label>
              Branch
              <select value={form.branchId} onChange={handleChange('branchId')}>
                <option value="">Default branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Category
            <input value={form.category} onChange={handleChange('category')} required />
          </label>
          <label>
            Amount
            <input type="number" step="0.01" value={form.amount} onChange={handleChange('amount')} required />
          </label>
          <label>
            Date
            <input type="date" value={form.date} onChange={handleChange('date')} required />
          </label>
          <label className="full-width">
            Description
            <textarea value={form.description} onChange={handleChange('description')} rows="3" />
          </label>
          <label className="full-width">
            Reference Number
            <input value={form.referenceNumber} onChange={handleChange('referenceNumber')} />
          </label>
          {error && <div className="form-error">{error}</div>}
          {success && <div className="success-box">{success}</div>}
          <button type="submit" className="btn btn-primary">Save Record</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h2>{type === 'income' ? 'Income' : 'Expense'} Records</h2>
        <div className="table-toolbar">
          <input type="date" value={filters.startDate} onChange={handleFilterChange('startDate')} />
          <input type="date" value={filters.endDate} onChange={handleFilterChange('endDate')} />
          <input placeholder="Category" value={filters.category} onChange={handleFilterChange('category')} />
          {canViewAllBranches(user) && (
            <select value={filters.branchId} onChange={handleFilterChange('branchId')}>
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-secondary" type="button" onClick={loadRecords}>Apply</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Branch</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Reference</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.date)}</td>
                  <td>{record.branch?.name || '-'}</td>
                  <td>{record.category}</td>
                  <td>{formatMoney(record.amount)}</td>
                  <td>{record.description || '-'}</td>
                  <td>{record.referenceNumber || '-'}</td>
                  <td>{record.recordedBy?.fullName || '-'}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
