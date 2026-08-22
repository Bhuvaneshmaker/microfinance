import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchCustomerById } from '../api';
import { formatDate, formatMoney } from '../utils';

export default function CustomerDetails() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadCustomer() {
      try {
        const response = await fetchCustomerById(id);
        setCustomer(response);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to load customer details');
      }
    }
    loadCustomer();
  }, [id]);

  const paymentHistory = useMemo(() => {
    if (!customer) return [];
    return customer.loans.flatMap((loan) =>
      (loan.payments || []).map((payment) => ({
        ...payment,
        loanNumber: loan.loanNumber,
        loanProductName: loan.loanProduct?.name,
      })),
    );
  }, [customer]);

  if (error) {
    return <div className="card"><p className="form-error">{error}</p></div>;
  }

  if (!customer) {
    return <div className="card"><p>Loading customer details...</p></div>;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <Link to="/customers" className="btn btn-secondary">Back to Customers</Link>
        <h1>{customer.firstName} {customer.lastName}</h1>
        <div className="grid-col-2">
          <div>
            <p><strong>Customer ID:</strong> {customer.customerId}</p>
            <p><strong>Status:</strong> <span className="badge">{customer.status}</span></p>
            <p><strong>Branch:</strong> {customer.branch?.name || '-'}</p>
            <p><strong>Date of Birth:</strong> {formatDate(customer.dateOfBirth)}</p>
            <p><strong>Gender:</strong> {customer.gender || '-'}</p>
            <p><strong>ID:</strong> {customer.idType || '-'} {customer.idNumber || ''}</p>
          </div>
          <div>
            <p><strong>Phone:</strong> {customer.phone || '-'}</p>
            <p><strong>Email:</strong> {customer.email || '-'}</p>
            <p><strong>Address:</strong> {customer.address || '-'}</p>
            <p><strong>Employment:</strong> {customer.employmentType || '-'}</p>
            <p><strong>Employer:</strong> {customer.employerName || '-'}</p>
            <p><strong>Business Name:</strong> {customer.businessName || '-'}</p>
            <p><strong>Income Source:</strong> {customer.incomeSource || '-'}</p>
          </div>
        </div>
      </div>

      <div className="grid-col-2" style={{ marginBottom: '16px' }}>
        <div className="card">
          <h2>Guarantors</h2>
          {(customer.guarantors || []).map((guarantor) => (
            <div key={guarantor.id}>
              <p><strong>{guarantor.name}</strong></p>
              <p>{guarantor.relationship || '-'} | {guarantor.phone || '-'}</p>
              <p>{guarantor.idType || '-'} {guarantor.idNumber || ''}</p>
              <p>{guarantor.address || '-'}</p>
            </div>
          ))}
          {(!customer.guarantors || customer.guarantors.length === 0) && <p className="muted">No guarantor recorded.</p>}
        </div>
        <div className="card">
          <h2>Next of Kin</h2>
          {(customer.nextOfKin || []).map((kin) => (
            <div key={kin.id}>
              <p><strong>{kin.name}</strong></p>
              <p>{kin.relationship || '-'} | {kin.phone || '-'}</p>
              <p>{kin.address || '-'}</p>
            </div>
          ))}
          {(!customer.nextOfKin || customer.nextOfKin.length === 0) && <p className="muted">No next of kin recorded.</p>}
        </div>
      </div>

      <div className="card">
        <h2>Loan Applications</h2>
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Application #</th>
              <th>Product</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Requested Tenor</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody>
            {customer.applications.map((application) => (
              <tr key={application.id}>
                <td>{application.applicationNumber}</td>
                <td>{application.loanProduct?.name || '-'}</td>
                <td>{formatMoney(application.requestedAmount)}</td>
                <td>{application.status}</td>
                <td>{application.requestedTenorMonths} months</td>
                <td>{application.createdBy?.fullName || '-'}</td>
              </tr>
            ))}
            {customer.applications.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>No loan applications found.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h2>Loan History</h2>
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Loan #</th>
              <th>Product</th>
              <th>Disbursed</th>
              <th>Maturity</th>
              <th>Principal</th>
              <th>Outstanding</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {customer.loans.map((loan) => (
              <tr key={loan.id}>
                <td>{loan.loanNumber}</td>
                <td>{loan.loanProduct?.name || '-'}</td>
                <td>{formatDate(loan.disbursementDate)}</td>
                <td>{formatDate(loan.maturityDate)}</td>
                <td>{formatMoney(loan.principalAmount)}</td>
                <td>{formatMoney(loan.outstandingPrincipal + loan.outstandingInterest + loan.outstandingFees + loan.outstandingPenalties)}</td>
                <td>{loan.status}</td>
              </tr>
            ))}
            {customer.loans.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center' }}>No loans found.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h2>Payment History</h2>
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Loan #</th>
              <th>Product</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {paymentHistory.map((payment) => (
              <tr key={payment.id}>
                <td>{formatDate(payment.paymentDate)}</td>
                <td>{payment.loanNumber}</td>
                <td>{payment.loanProductName || '-'}</td>
                <td>{formatMoney(payment.amount)}</td>
                <td>{payment.method}</td>
                <td>{payment.referenceNumber || '-'}</td>
              </tr>
            ))}
            {paymentHistory.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>No payments have been recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h2>Documents</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Path</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {(customer.documents || []).map((document) => (
                <tr key={document.id}>
                  <td>{document.documentType}</td>
                  <td>{document.filePath}</td>
                  <td>{formatDate(document.uploadedAt)}</td>
                </tr>
              ))}
              {(!customer.documents || customer.documents.length === 0) && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center' }}>No supporting documents recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
