import { useEffect, useMemo, useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import {
  fetchBranches,
  fetchLoans,
  fetchPendingDisbursements,
  fetchLoanSchedule,
  fetchLoanPayments,
  disburseLoan,
  postLoanPayment,
} from '../api';
import { canViewAllBranches, formatDate, formatMoney } from '../utils';

export default function Loans() {
  const { user } = useAuthContext();
  const [activeLoans, setActiveLoans] = useState([]);
  const [pendingDisbursements, setPendingDisbursements] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedLoanSchedule, setSelectedLoanSchedule] = useState([]);
  const [selectedLoanPayments, setSelectedLoanPayments] = useState([]);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'Cash', referenceNumber: '', paymentDate: '' });
  const [disbursementForms, setDisbursementForms] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadLoans = async () => {
    try {
      const response = await fetchLoans(branchId ? { branchId } : undefined);
      setActiveLoans(response);
      setError(null);
    } catch (err) {
      setError('Unable to load loans');
    }
  };

  const loadPendingDisbursements = async () => {
    try {
      const response = await fetchPendingDisbursements(branchId ? { branchId } : undefined);
      setPendingDisbursements(response);
      setError(null);
    } catch (err) {
      setError('Unable to load pending disbursements');
    }
  };

  useEffect(() => {
    loadLoans();
    loadPendingDisbursements();
  }, [branchId]);

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

  const handlePaymentChange = (field) => (event) => setPaymentForm({ ...paymentForm, [field]: event.target.value });

  const handleDisbursementChange = (applicationId, field) => (event) => {
    setDisbursementForms((prev) => ({
      ...prev,
      [applicationId]: {
        ...(prev[applicationId] || { amount: '', method: 'Cash', referenceNumber: '', disbursementDate: '' }),
        [field]: event.target.value,
      },
    }));
  };

  const loadLoanDetails = async (loan) => {
    setSelectedLoan(loan);
    setSuccess(null);
    setError(null);
    setDetailsLoading(true);
    try {
      const schedule = await fetchLoanSchedule(loan.id);
      setSelectedLoanSchedule(schedule);
      try {
        const payments = await fetchLoanPayments(loan.id);
        setSelectedLoanPayments(payments);
      } catch (paymentError) {
        setSelectedLoanPayments([]);
      }
    } catch (err) {
      setSelectedLoanSchedule([]);
      setSelectedLoanPayments([]);
      setError(err.response?.data?.error?.message || 'Unable to load loan details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const submitPayment = async (loanId) => {
    setError(null);
    setSuccess(null);
    try {
      await postLoanPayment(loanId, {
        amount: paymentForm.amount,
        method: paymentForm.method,
        referenceNumber: paymentForm.referenceNumber,
        paymentDate: paymentForm.paymentDate,
      });
      setSuccess('Payment posted successfully.');
      setPaymentForm({ amount: '', method: 'Cash', referenceNumber: '', paymentDate: '' });
      await loadLoans();
      if (selectedLoan?.id === loanId) {
        await loadLoanDetails({ ...selectedLoan });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to post payment');
    }
  };

  const submitDisbursement = async (applicationId) => {
    setError(null);
    setSuccess(null);
    const form = disbursementForms[applicationId] || { amount: '', method: 'Cash', referenceNumber: '', disbursementDate: '' };

    try {
      await disburseLoan(applicationId, {
        amount: form.amount,
        method: form.method,
        referenceNumber: form.referenceNumber,
        disbursementDate: form.disbursementDate,
      });
      setSuccess('Loan disbursed successfully.');
      setDisbursementForms((prev) => ({
        ...prev,
        [applicationId]: { amount: '', method: 'Cash', referenceNumber: '', disbursementDate: '' },
      }));
      await loadLoans();
      await loadPendingDisbursements();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to disburse loan');
    }
  };

  const nextDueEntry = useMemo(() => {
    if (!selectedLoanSchedule.length) return null;
    return selectedLoanSchedule
      .filter((entry) => entry.status !== 'Paid')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
  }, [selectedLoanSchedule]);

  const selectedLoanOutstanding = useMemo(() => {
    if (!selectedLoan) return 0;
    return (
      (selectedLoan.outstandingPrincipal || 0)
      + (selectedLoan.outstandingInterest || 0)
      + (selectedLoan.outstandingFees || 0)
      + (selectedLoan.outstandingPenalties || 0)
    );
  }, [selectedLoan]);

  return (
    <div>
      <h1>Loan Management</h1>
      {canViewAllBranches(user) && (
        <div className="table-toolbar">
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <button className="btn btn-secondary" type="button" onClick={() => { loadLoans(); loadPendingDisbursements(); }}>Refresh</button>
        </div>
      )}
      <div className="grid-col-2">
        <div className="card">
          <h2>Pending Disbursement Queue</h2>
          {pendingDisbursements.length === 0 && <p>No approved applications are waiting for disbursement.</p>}
          {pendingDisbursements.map((application) => {
            const form = disbursementForms[application.id] || { amount: '', method: 'Cash', referenceNumber: '', disbursementDate: '' };
            return (
              <div key={application.id} className="card" style={{ marginBottom: '12px' }}>
                <strong>{application.applicationNumber}</strong>
                <p>{application.customer?.firstName} {application.customer?.lastName}</p>
                <p>Branch: {application.branch?.name || '-'}</p>
                <p>Product: {application.loanProduct?.name}</p>
                <p>Requested: {formatMoney(application.requestedAmount)}</p>
                <p>Status: {application.status}</p>
                <div className="form-grid">
                  <label>
                    Disbursement Date
                    <input type="date" value={form.disbursementDate} onChange={handleDisbursementChange(application.id, 'disbursementDate')} />
                  </label>
                  <label>
                    Amount
                    <input type="number" step="0.01" value={form.amount} onChange={handleDisbursementChange(application.id, 'amount')} placeholder={application.requestedAmount.toString()} />
                  </label>
                  <label>
                    Method
                    <select value={form.method} onChange={handleDisbursementChange(application.id, 'method')}>
                      <option value="Cash">Cash</option>
                      <option value="BankTransfer">Bank Transfer</option>
                      <option value="MobileMoney">Mobile Money</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label>
                    Reference
                    <input value={form.referenceNumber} onChange={handleDisbursementChange(application.id, 'referenceNumber')} />
                  </label>
                  {user?.role?.canApproveLoans || user?.role?.canPostPayments ? (
                    <button type="button" className="btn btn-primary" onClick={() => submitDisbursement(application.id)}>
                      Disburse
                    </button>
                  ) : (
                    <span style={{ color: '#6b7280' }}>Disbursement restricted</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h2>Active Loans</h2>
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Loan Number</th>
                <th>Customer</th>
                <th>Branch</th>
                <th>Product</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeLoans.map((loan) => (
                <tr key={loan.id}>
                  <td>{loan.loanNumber}</td>
                  <td>{loan.customer?.firstName} {loan.customer?.lastName}</td>
                  <td>{loan.branch?.name || '-'}</td>
                  <td>{loan.loanProduct?.name}</td>
                  <td>{formatMoney(
                    (loan.outstandingPrincipal || 0)
                    + (loan.outstandingInterest || 0)
                    + (loan.outstandingFees || 0)
                    + (loan.outstandingPenalties || 0),
                  )}</td>
                  <td>{loan.status}</td>
                  <td>
                    <button className="btn btn-secondary" type="button" onClick={() => loadLoanDetails(loan)}>
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {activeLoans.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>No active loans available.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginTop: '16px' }}>{error}</div>}
      {success && <div className="success-box" style={{ marginTop: '16px' }}>{success}</div>}

      {selectedLoan && (
        <div className="card" style={{ marginTop: '16px' }}>
          <h2>Loan Details: {selectedLoan.loanNumber}</h2>
          <div className="grid-col-3" style={{ marginBottom: '16px' }}>
            <div>
              <p><strong>Customer</strong></p>
              <p>{selectedLoan.customer?.firstName} {selectedLoan.customer?.lastName}</p>
            </div>
            <div>
              <p><strong>Disbursed</strong></p>
              <p>{formatDate(selectedLoan.disbursementDate)}</p>
            </div>
            <div>
              <p><strong>Maturity</strong></p>
              <p>{formatDate(selectedLoan.maturityDate)}</p>
            </div>
          </div>
          <div className="grid-col-3" style={{ marginBottom: '16px' }}>
            <div>
              <p><strong>Principal</strong></p>
              <p>{formatMoney(selectedLoan.principalAmount)}</p>
            </div>
            <div>
              <p><strong>Outstanding</strong></p>
              <p>{formatMoney(selectedLoanOutstanding)}</p>
            </div>
            <div>
              <p><strong>Next Due</strong></p>
              <p>{nextDueEntry ? `${formatDate(nextDueEntry.dueDate)} (${nextDueEntry.status})` : 'None'}</p>
            </div>
          </div>

          {user?.role?.canPostPayments ? (
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submitPayment(selectedLoan.id); }}>
            <label>
              Amount
              <input type="number" step="0.01" value={paymentForm.amount} onChange={handlePaymentChange('amount')} required />
            </label>
            <label>
              Payment Date
              <input type="date" value={paymentForm.paymentDate} onChange={handlePaymentChange('paymentDate')} />
            </label>
            <label>
              Method
              <select value={paymentForm.method} onChange={handlePaymentChange('method')}>
                <option value="Cash">Cash</option>
                <option value="BankTransfer">Bank Transfer</option>
                <option value="MobileMoney">Mobile Money</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label className="full-width">
              Reference Number
              <input value={paymentForm.referenceNumber} onChange={handlePaymentChange('referenceNumber')} />
            </label>
            <div />
            <div />
            <button type="submit" className="btn btn-primary">Submit Payment</button>
          </form>
          ) : (
            <p className="muted">Payment posting is restricted for your role.</p>
          )}

          {detailsLoading ? (
            <p style={{ marginTop: '16px' }}>Loading loan details...</p>
          ) : (
            <>
              <div className="card" style={{ marginTop: '16px' }}>
                <h3>Payment Schedule</h3>
                <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Due Date</th>
                      <th>Principal</th>
                      <th>Interest</th>
                      <th>Fees</th>
                      <th>Penalties</th>
                      <th>Paid</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLoanSchedule.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.installmentNumber}</td>
                        <td>{formatDate(entry.dueDate)}</td>
                        <td>{formatMoney(entry.principalDue)}</td>
                        <td>{formatMoney(entry.interestDue)}</td>
                        <td>{formatMoney(entry.feesDue)}</td>
                        <td>{formatMoney(entry.penaltiesDue)}</td>
                        <td>{formatMoney(entry.amountPaid)}</td>
                        <td>{entry.status}</td>
                      </tr>
                    ))}
                    {selectedLoanSchedule.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center' }}>No schedule entries available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="card" style={{ marginTop: '16px' }}>
                <h3>Payment History</h3>
                <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLoanPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDate(payment.paymentDate)}</td>
                        <td>{formatMoney(payment.amount)}</td>
                        <td>{payment.method}</td>
                        <td>{payment.referenceNumber || '-'}</td>
                      </tr>
                    ))}
                    {selectedLoanPayments.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center' }}>No payments recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
