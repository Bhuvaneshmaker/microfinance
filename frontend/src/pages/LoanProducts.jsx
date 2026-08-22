import { useEffect, useState } from 'react';
import { createLoanProduct, fetchBranches, fetchLoanProducts } from '../api';
import { useAuthContext } from '../context/AuthContext';
import { canViewAllBranches, formatMoney } from '../utils';

const emptyForm = {
  name: '',
  description: '',
  branchId: '',
  interestRate: '',
  interestType: 'Flat',
  repaymentFrequency: 'Monthly',
  minTenorMonths: 1,
  maxTenorMonths: 12,
  minAmount: '',
  maxAmount: '',
  processingFeePercent: 0,
  processingFeeFixed: 0,
  lateFeeRule: 'Flat',
  gracePeriodDays: 0,
  lateFeeAmount: 0,
  approvalThreshold: 0,
  status: 'Active',
};

export default function LoanProducts() {
  const { user } = useAuthContext();
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadProducts = async () => {
    try {
      const response = await fetchLoanProducts(branchId ? { branchId } : undefined);
      setProducts(response);
      setError(null);
    } catch (err) {
      setError('Failed to load loan products');
    }
  };

  useEffect(() => {
    loadProducts();
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

  const handleChange = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await createLoanProduct(form);
      setForm(emptyForm);
      setSuccess('Loan product saved successfully.');
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save loan product');
    }
  };

  return (
    <div>
      <h1>Loan Products</h1>
      {user?.role?.canManageUsers && (
        <div className="card">
          <h2>Create Loan Product</h2>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Name
              <input value={form.name} onChange={handleChange('name')} required />
            </label>
            <label>
              Status
              <select value={form.status} onChange={handleChange('status')}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
            <label className="full-width">
              Description
              <textarea value={form.description} onChange={handleChange('description')} rows="2" />
            </label>
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
              Interest Rate (%)
              <input value={form.interestRate} type="number" step="0.01" onChange={handleChange('interestRate')} required />
            </label>
            <label>
              Interest Type
              <select value={form.interestType} onChange={handleChange('interestType')}>
                <option value="Flat">Flat</option>
                <option value="DecliningBalance">Declining Balance</option>
                <option value="ReducingBalance">Reducing Balance</option>
              </select>
            </label>
            <label>
              Frequency
              <select value={form.repaymentFrequency} onChange={handleChange('repaymentFrequency')}>
                <option value="Weekly">Weekly</option>
                <option value="Biweekly">Biweekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
              </select>
            </label>
            <label>
              Min Amount
              <input value={form.minAmount} type="number" step="0.01" onChange={handleChange('minAmount')} required />
            </label>
            <label>
              Max Amount
              <input value={form.maxAmount} type="number" step="0.01" onChange={handleChange('maxAmount')} required />
            </label>
            <label>
              Min Tenor Months
              <input value={form.minTenorMonths} type="number" onChange={handleChange('minTenorMonths')} required />
            </label>
            <label>
              Max Tenor Months
              <input value={form.maxTenorMonths} type="number" onChange={handleChange('maxTenorMonths')} required />
            </label>
            <label>
              Processing Fee %
              <input value={form.processingFeePercent} type="number" step="0.01" onChange={handleChange('processingFeePercent')} />
            </label>
            <label>
              Processing Fee Fixed
              <input value={form.processingFeeFixed} type="number" step="0.01" onChange={handleChange('processingFeeFixed')} />
            </label>
            <label>
              Late Fee Rule
              <input value={form.lateFeeRule} onChange={handleChange('lateFeeRule')} />
            </label>
            <label>
              Grace Period Days
              <input value={form.gracePeriodDays} type="number" onChange={handleChange('gracePeriodDays')} />
            </label>
            <label>
              Late Fee Amount
              <input value={form.lateFeeAmount} type="number" step="0.01" onChange={handleChange('lateFeeAmount')} />
            </label>
            <label>
              Approval Threshold
              <input value={form.approvalThreshold} type="number" step="0.01" onChange={handleChange('approvalThreshold')} />
            </label>
            {error && <div className="form-error">{error}</div>}
            {success && <div className="success-box">{success}</div>}
            <button type="submit" className="btn btn-primary">Save Product</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-toolbar">
          {canViewAllBranches(user) && (
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-secondary" type="button" onClick={loadProducts}>Refresh</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Branch</th>
                <th>Interest</th>
                <th>Frequency</th>
                <th>Amount</th>
                <th>Tenor</th>
                <th>Fees</th>
                <th>Approval Threshold</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.branch?.name || '-'}</td>
                  <td>{product.interestRate}% {product.interestType}</td>
                  <td>{product.repaymentFrequency}</td>
                  <td>{formatMoney(product.minAmount)} - {formatMoney(product.maxAmount)}</td>
                  <td>{product.minTenorMonths} - {product.maxTenorMonths} months</td>
                  <td>{product.processingFeePercent}% + {formatMoney(product.processingFeeFixed)}</td>
                  <td>{formatMoney(product.approvalThreshold)}</td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center' }}>No loan products configured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
