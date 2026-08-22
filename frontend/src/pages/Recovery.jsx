import { useEffect, useState } from 'react';
import { createRecoveryAction, fetchBranches, fetchOverdueLoans, fetchRecoveryActions } from '../api';
import { useAuthContext } from '../context/AuthContext';
import { canViewAllBranches, formatDate, formatMoney } from '../utils';

const emptyActionForm = {
  actionType: 'PhoneCall',
  notes: '',
  actionDate: new Date().toISOString().split('T')[0],
  nextFollowUpDate: '',
  status: 'InProgress',
};

export default function Recovery() {
  const { user } = useAuthContext();
  const [overdueLoans, setOverdueLoans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [actions, setActions] = useState([]);
  const [actionForm, setActionForm] = useState(emptyActionForm);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadOverdue = async () => {
    try {
      const data = await fetchOverdueLoans(branchId ? { branchId } : undefined);
      setOverdueLoans(data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load overdue loans');
    }
  };

  useEffect(() => {
    loadOverdue();
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

  const loadActions = async (loanId) => {
    try {
      const response = await fetchRecoveryActions(loanId);
      setActions(response);
    } catch (err) {
      setError('Failed to load recovery history');
    }
  };

  const selectLoan = (loan) => {
    setSelectedLoan(loan);
    setActions([]);
    setError(null);
    setSuccess(null);
    loadActions(loan.id);
  };

  const handleChange = (field) => (event) => setActionForm({ ...actionForm, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await createRecoveryAction({
        ...actionForm,
        loanId: selectedLoan.id,
      });
      setSuccess('Recovery follow-up logged successfully.');
      setActionForm(emptyActionForm);
      loadActions(selectedLoan.id);
      loadOverdue();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to record action');
    }
  };

  return (
    <div>
      <h1>Overdue Loans & Recovery Management</h1>
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
          <button className="btn btn-secondary" type="button" onClick={loadOverdue}>Refresh</button>
        </div>
        <h2>Overdue Portfolio</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Loan Number</th>
                <th>Customer</th>
                <th>Branch</th>
                <th>Phone</th>
                <th>Days Overdue</th>
                <th>Overdue Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {overdueLoans.map((loan) => (
                <tr key={loan.id}>
                  <td>{loan.loanNumber}</td>
                  <td>{loan.customer?.firstName} {loan.customer?.lastName}</td>
                  <td>{loan.branch?.name || '-'}</td>
                  <td>{loan.customer?.phone || '-'}</td>
                  <td><b style={{ color: '#dc2626' }}>{loan.overdueDays} days</b></td>
                  <td>{formatMoney(loan.overdueAmount)}</td>
                  <td>
                    <button className="btn btn-primary btn-compact" type="button" onClick={() => selectLoan(loan)}>
                      Follow Up
                    </button>
                  </td>
                </tr>
              ))}
              {overdueLoans.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>No overdue loans found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLoan && (
        <div className="grid-col-2" style={{ marginTop: '16px' }}>
          <div className="card">
            <h2>Record Follow-up: {selectedLoan.loanNumber}</h2>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                Action Type
                <select value={actionForm.actionType} onChange={handleChange('actionType')}>
                  <option value="PhoneCall">Phone Call</option>
                  <option value="FieldVisit">Field Visit</option>
                  <option value="DemandLetter">Demand Letter Issued</option>
                  <option value="GuarantorContacted">Guarantor Contacted</option>
                  <option value="LegalNotice">Legal Notice</option>
                </select>
              </label>
              <label>
                Action Date
                <input type="date" value={actionForm.actionDate} onChange={handleChange('actionDate')} required />
              </label>
              <label>
                Next Follow-up Date
                <input type="date" value={actionForm.nextFollowUpDate} onChange={handleChange('nextFollowUpDate')} />
              </label>
              <label>
                Recovery Status
                <select value={actionForm.status} onChange={handleChange('status')}>
                  <option value="Open">Open</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Escalated">Escalated</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </label>
              <label className="full-width">
                Notes & Remarks
                <textarea value={actionForm.notes} onChange={handleChange('notes')} rows="3" required />
              </label>
              {error && <div className="form-error">{error}</div>}
              {success && <div className="success-box">{success}</div>}
              <div className="actions-row">
                <button type="submit" className="btn btn-primary">Save Recovery Action</button>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedLoan(null)}>Close</button>
              </div>
            </form>
          </div>
          <div className="card">
            <h2>Recovery History</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Next</th>
                    <th>Officer</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => (
                    <tr key={action.id}>
                      <td>{formatDate(action.actionDate)}</td>
                      <td>{action.actionType}</td>
                      <td>{action.status}</td>
                      <td>{formatDate(action.nextFollowUpDate)}</td>
                      <td>{action.recoveryOfficer?.fullName || '-'}</td>
                    </tr>
                  ))}
                  {actions.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center' }}>No recovery history recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
