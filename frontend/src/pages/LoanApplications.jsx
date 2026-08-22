import { useEffect, useMemo, useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import {
  approveLoanApplication,
  createLoanApplication,
  fetchBranches,
  fetchCustomers,
  fetchLoanApplications,
  fetchLoanProducts,
  rejectLoanApplication,
  returnLoanApplication,
  submitLoanApplication,
} from '../api';
import { canViewAllBranches, formatMoney } from '../utils';

const emptyForm = {
  customerId: '',
  loanProductId: '',
  requestedAmount: '',
  requestedTenorMonths: '',
  requestedFrequency: 'Monthly',
  interestRate: '',
  processingFee: '',
  purpose: '',
  branchId: '',
};

export default function LoanApplications() {
  const { user } = useAuthContext();
  const [applications, setApplications] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [comments, setComments] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const params = useMemo(() => ({
    ...(branchId ? { branchId } : {}),
    ...(status ? { status } : {}),
  }), [branchId, status]);

  const loadApplications = async () => {
    try {
      const response = await fetchLoanApplications(params);
      setApplications(response);
      setError(null);
    } catch (err) {
      setError('Failed to load applications');
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await fetchCustomers('', branchId ? { branchId } : undefined);
      setCustomers(response);
    } catch (err) {
      setError('Failed to load customers');
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetchLoanProducts(branchId ? { branchId } : undefined);
      setProducts(response);
    } catch (err) {
      setError('Failed to load loan products');
    }
  };

  useEffect(() => {
    loadApplications();
  }, [params]);

  useEffect(() => {
    loadCustomers();
    loadProducts();
    setForm((current) => ({ ...current, branchId, customerId: '', loanProductId: '' }));
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

  const selectedProduct = products.find((product) => product.id === form.loanProductId);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    if (field === 'loanProductId') {
      const product = products.find((item) => item.id === value);
      const amount = Number(form.requestedAmount || 0);
      setForm({
        ...form,
        loanProductId: value,
        requestedFrequency: product?.repaymentFrequency || form.requestedFrequency,
        interestRate: product?.interestRate ?? form.interestRate,
        processingFee: product && amount
          ? ((amount * product.processingFeePercent) / 100) + product.processingFeeFixed
          : form.processingFee,
      });
      return;
    }
    if (field === 'requestedAmount' && selectedProduct) {
      const amount = Number(value || 0);
      setForm({
        ...form,
        requestedAmount: value,
        processingFee: amount ? ((amount * selectedProduct.processingFeePercent) / 100) + selectedProduct.processingFeeFixed : '',
      });
      return;
    }
    setForm({ ...form, [field]: value });
  };

  const submitApplication = async (id) => {
    try {
      await submitLoanApplication(id);
      setSuccess('Application submitted for review.');
      loadApplications();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to submit application');
    }
  };

  const reviewApplication = async (id, action) => {
    try {
      const comment = comments[id] || `${action} by ${user?.fullName || 'authorized user'}`;
      if (action === 'Approved') await approveLoanApplication(id, comment);
      if (action === 'Rejected') await rejectLoanApplication(id, comment);
      if (action === 'Returned') await returnLoanApplication(id, comment);
      setSuccess(`Application ${action.toLowerCase()}.`);
      setComments({ ...comments, [id]: '' });
      loadApplications();
    } catch (err) {
      setError(err.response?.data?.error?.message || `Failed to mark application as ${action.toLowerCase()}`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await createLoanApplication(form);
      setForm({ ...emptyForm, branchId });
      setSuccess('Loan application saved as draft.');
      loadApplications();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create loan application');
    }
  };

  return (
    <div>
      <h1>Loan Applications</h1>
      <div className="table-toolbar">
        {canViewAllBranches(user) && (
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        )}
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Any status</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
          <option value="UnderReview">Under Review</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Returned">Returned</option>
          <option value="Disbursed">Disbursed</option>
          <option value="Closed">Closed</option>
          <option value="Defaulted">Defaulted</option>
        </select>
        <button className="btn btn-secondary" type="button" onClick={loadApplications}>Refresh</button>
      </div>

      <div className="card">
        <h2>Create Application</h2>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Customer
            <select value={form.customerId} onChange={handleChange('customerId')} required>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customerId} - {customer.firstName} {customer.lastName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loan Product
            <select value={form.loanProductId} onChange={handleChange('loanProductId')} required>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>
          <label>
            Requested Amount
            <input value={form.requestedAmount} type="number" step="0.01" onChange={handleChange('requestedAmount')} required />
          </label>
          <label>
            Tenor (months)
            <input value={form.requestedTenorMonths} type="number" onChange={handleChange('requestedTenorMonths')} required />
          </label>
          <label>
            Frequency
            <select value={form.requestedFrequency} onChange={handleChange('requestedFrequency')}>
              <option value="Weekly">Weekly</option>
              <option value="Biweekly">Biweekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
            </select>
          </label>
          <label>
            Interest Rate
            <input value={form.interestRate} type="number" step="0.01" onChange={handleChange('interestRate')} />
          </label>
          <label>
            Processing Fee
            <input value={form.processingFee} type="number" step="0.01" onChange={handleChange('processingFee')} />
          </label>
          <label className="full-width">
            Purpose
            <textarea value={form.purpose} onChange={handleChange('purpose')} rows="3" />
          </label>
          {selectedProduct && (
            <div className="success-box full-width">
              Amount range {formatMoney(selectedProduct.minAmount)} - {formatMoney(selectedProduct.maxAmount)}; tenor {selectedProduct.minTenorMonths} - {selectedProduct.maxTenorMonths} months.
            </div>
          )}
          {error && <div className="form-error">{error}</div>}
          {success && <div className="success-box">{success}</div>}
          <button type="submit" className="btn btn-primary">Save Draft</button>
        </form>
      </div>

      <div className="card">
        <h2>Applications</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>App Number</th>
                <th>Customer</th>
                <th>Branch</th>
                <th>Product</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Review</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td>{application.applicationNumber}</td>
                  <td>{application.customer?.firstName} {application.customer?.lastName}</td>
                  <td>{application.branch?.name || '-'}</td>
                  <td>{application.loanProduct?.name}</td>
                  <td>{formatMoney(application.requestedAmount)}</td>
                  <td><span className="badge">{application.status}</span></td>
                  <td>
                    {application.approvalRecords?.[0]?.comment || '-'}
                  </td>
                  <td>
                    <div className="actions-row">
                      {(application.status === 'Draft' || application.status === 'Returned') && (
                        <button className="btn btn-secondary btn-compact" type="button" onClick={() => submitApplication(application.id)}>
                          Submit
                        </button>
                      )}
                      {(application.status === 'Submitted' || application.status === 'UnderReview') && user?.role?.canApproveLoans && (
                        <>
                          <input
                            value={comments[application.id] || ''}
                            onChange={(event) => setComments({ ...comments, [application.id]: event.target.value })}
                            placeholder="Approval comment"
                          />
                          <button className="btn btn-primary btn-compact" type="button" onClick={() => reviewApplication(application.id, 'Approved')}>
                            Approve
                          </button>
                          <button className="btn btn-secondary btn-compact" type="button" onClick={() => reviewApplication(application.id, 'Returned')}>
                            Return
                          </button>
                          <button className="btn btn-danger btn-compact" type="button" onClick={() => reviewApplication(application.id, 'Rejected')}>
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center' }}>No applications found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
