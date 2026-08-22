import { useEffect, useState } from 'react';
import { createBranch, fetchBranches, updateBranch } from '../api';
import { useAuthContext } from '../context/AuthContext';

const emptyForm = { code: '', name: '', location: '', isActive: true };

export default function Branches() {
  const { user } = useAuthContext();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const canManage = Boolean(user?.role?.canManageUsers);

  const loadBranches = async () => {
    try {
      const response = await fetchBranches(canManage ? { includeInactive: true } : undefined);
      setBranches(response);
      setError(null);
    } catch (err) {
      setError('Failed to load branches');
    }
  };

  useEffect(() => {
    loadBranches();
  }, [canManage]);

  const handleChange = (field) => (event) => {
    const value = field === 'isActive' ? event.target.value === 'true' : event.target.value;
    setForm({ ...form, [field]: value });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (editingId) {
        await updateBranch(editingId, form);
        setSuccess('Branch updated successfully.');
      } else {
        await createBranch(form);
        setSuccess('Branch created successfully.');
      }
      resetForm();
      loadBranches();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save branch');
    }
  };

  const editBranch = (branch) => {
    setEditingId(branch.id);
    setForm({
      code: branch.code,
      name: branch.name,
      location: branch.location || '',
      isActive: branch.isActive,
    });
  };

  const toggleStatus = async (branch) => {
    setError(null);
    setSuccess(null);
    try {
      await updateBranch(branch.id, { ...branch, isActive: !branch.isActive });
      setSuccess(`Branch ${branch.isActive ? 'deactivated' : 'activated'} successfully.`);
      loadBranches();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update branch status');
    }
  };

  return (
    <div>
      <h1>Branch Management</h1>
      {canManage && (
        <div className="card">
          <h2>{editingId ? 'Edit Branch' : 'Add Branch'}</h2>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Code
              <input value={form.code} onChange={handleChange('code')} required />
            </label>
            <label>
              Name
              <input value={form.name} onChange={handleChange('name')} required />
            </label>
            <label>
              Location
              <input value={form.location} onChange={handleChange('location')} />
            </label>
            <label>
              Status
              <select value={String(form.isActive)} onChange={handleChange('isActive')}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            {error && <div className="form-error">{error}</div>}
            {success && <div className="success-box">{success}</div>}
            <div className="actions-row">
              <button type="submit" className="btn btn-primary">{editingId ? 'Update Branch' : 'Save Branch'}</button>
              {editingId && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>}
            </div>
          </form>
        </div>
      )}
      <div className="card" style={{ marginTop: '16px' }}>
        <h2>Branch List</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id}>
                  <td>{branch.code}</td>
                  <td>{branch.name}</td>
                  <td>{branch.location || '-'}</td>
                  <td><span className="badge">{branch.isActive ? 'Active' : 'Inactive'}</span></td>
                  {canManage && (
                    <td>
                      <div className="actions-row">
                        <button type="button" className="btn btn-secondary btn-compact" onClick={() => editBranch(branch)}>Edit</button>
                        <button type="button" className="btn btn-danger btn-compact" onClick={() => toggleStatus(branch)}>
                          {branch.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {branches.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} style={{ textAlign: 'center' }}>No branches found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!canManage && error && <div className="form-error">{error}</div>}
      </div>
    </div>
  );
}
