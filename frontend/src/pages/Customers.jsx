import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCustomer, fetchBranches, fetchCustomers } from '../api';
import { useAuthContext } from '../context/AuthContext';
import { canViewAllBranches } from '../utils';

const emptyForm = {
  firstName: '',
  lastName: '',
  otherNames: '',
  customerId: '',
  dateOfBirth: '',
  gender: '',
  idType: '',
  idNumber: '',
  phone: '',
  email: '',
  address: '',
  employmentType: '',
  employerName: '',
  businessName: '',
  incomeSource: '',
  status: 'Active',
  branchId: '',
  guarantor: { name: '', relationship: '', phone: '', address: '', idType: '', idNumber: '' },
  nextOfKin: { name: '', relationship: '', phone: '', address: '' },
};

export default function Customers() {
  const { user } = useAuthContext();
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadCustomers = async () => {
    try {
      const response = await fetchCustomers(search, { status, branchId });
      setCustomers(response);
      setError(null);
    } catch (err) {
      setError('Failed to load customers');
    }
  };

  useEffect(() => {
    loadCustomers();
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

  const handleChange = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const handleNestedChange = (group, field) => (event) => {
    setForm({ ...form, [group]: { ...form[group], [field]: event.target.value } });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await createCustomer(form);
      setForm(emptyForm);
      setSuccess('Customer profile created successfully.');
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create customer');
    }
  };

  return (
    <div>
      <h1>Customers</h1>
      <div className="card">
        <h2>Create Customer</h2>
        <form className="form-grid" onSubmit={handleSubmit}>
          <fieldset>
            <legend>Identity</legend>
            <div className="form-grid">
              <label>
                Customer ID
                <input value={form.customerId} onChange={handleChange('customerId')} required />
              </label>
              <label>
                Status
                <select value={form.status} onChange={handleChange('status')}>
                  <option value="Active">Active</option>
                  <option value="Dormant">Dormant</option>
                  <option value="Delinquent">Delinquent</option>
                  <option value="Closed">Closed</option>
                  <option value="Blacklisted">Blacklisted</option>
                </select>
              </label>
              <label>
                First Name
                <input value={form.firstName} onChange={handleChange('firstName')} required />
              </label>
              <label>
                Last Name
                <input value={form.lastName} onChange={handleChange('lastName')} required />
              </label>
              <label>
                Other Names
                <input value={form.otherNames} onChange={handleChange('otherNames')} />
              </label>
              <label>
                Date of Birth
                <input type="date" value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} />
              </label>
              <label>
                Gender
                <input value={form.gender} onChange={handleChange('gender')} />
              </label>
              <label>
                ID Type
                <input value={form.idType} onChange={handleChange('idType')} />
              </label>
              <label>
                ID Number
                <input value={form.idNumber} onChange={handleChange('idNumber')} />
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
            </div>
          </fieldset>

          <fieldset>
            <legend>Contact and Work</legend>
            <div className="form-grid">
              <label>
                Phone
                <input value={form.phone} onChange={handleChange('phone')} />
              </label>
              <label>
                Email
                <input value={form.email} onChange={handleChange('email')} type="email" />
              </label>
              <label className="full-width">
                Address
                <textarea value={form.address} onChange={handleChange('address')} rows="2" />
              </label>
              <label>
                Employment Type
                <input value={form.employmentType} onChange={handleChange('employmentType')} />
              </label>
              <label>
                Employer
                <input value={form.employerName} onChange={handleChange('employerName')} />
              </label>
              <label>
                Business Name
                <input value={form.businessName} onChange={handleChange('businessName')} />
              </label>
              <label>
                Income Source
                <input value={form.incomeSource} onChange={handleChange('incomeSource')} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Guarantor</legend>
            <div className="form-grid">
              <label>
                Name
                <input value={form.guarantor.name} onChange={handleNestedChange('guarantor', 'name')} />
              </label>
              <label>
                Relationship
                <input value={form.guarantor.relationship} onChange={handleNestedChange('guarantor', 'relationship')} />
              </label>
              <label>
                Phone
                <input value={form.guarantor.phone} onChange={handleNestedChange('guarantor', 'phone')} />
              </label>
              <label>
                ID Type
                <input value={form.guarantor.idType} onChange={handleNestedChange('guarantor', 'idType')} />
              </label>
              <label>
                ID Number
                <input value={form.guarantor.idNumber} onChange={handleNestedChange('guarantor', 'idNumber')} />
              </label>
              <label className="full-width">
                Address
                <textarea value={form.guarantor.address} onChange={handleNestedChange('guarantor', 'address')} rows="2" />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Next of Kin</legend>
            <div className="form-grid">
              <label>
                Name
                <input value={form.nextOfKin.name} onChange={handleNestedChange('nextOfKin', 'name')} />
              </label>
              <label>
                Relationship
                <input value={form.nextOfKin.relationship} onChange={handleNestedChange('nextOfKin', 'relationship')} />
              </label>
              <label>
                Phone
                <input value={form.nextOfKin.phone} onChange={handleNestedChange('nextOfKin', 'phone')} />
              </label>
              <label className="full-width">
                Address
                <textarea value={form.nextOfKin.address} onChange={handleNestedChange('nextOfKin', 'address')} rows="2" />
              </label>
            </div>
          </fieldset>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="success-box">{success}</div>}
          <button type="submit" className="btn btn-primary">Save Customer</button>
        </form>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <input placeholder="Search customers" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Any status</option>
            <option value="Active">Active</option>
            <option value="Dormant">Dormant</option>
            <option value="Delinquent">Delinquent</option>
            <option value="Closed">Closed</option>
            <option value="Blacklisted">Blacklisted</option>
          </select>
          {canViewAllBranches(user) && (
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-secondary" type="button" onClick={loadCustomers}>Search</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Name</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.customerId}</td>
                  <td>{customer.firstName} {customer.lastName}</td>
                  <td>{customer.branch?.name || '-'}</td>
                  <td><span className="badge">{customer.status}</span></td>
                  <td>{customer.phone || '-'}</td>
                  <td>{customer.email || '-'}</td>
                  <td>
                    <Link to={`/customers/${customer.id}`} className="btn btn-secondary btn-compact">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>No customers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
