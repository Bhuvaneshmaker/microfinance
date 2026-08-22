import { useEffect, useState } from 'react';
import { createUser, fetchBranches, fetchRoles, fetchUsers, updateUser } from '../api';
import { useAuthContext } from '../context/AuthContext';

const emptyForm = {
  username: '',
  email: '',
  fullName: '',
  password: '',
  roleId: '',
  branchId: '',
  status: 'Active',
};

export default function Users() {
  const { user: currentUser } = useAuthContext();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const canManage = Boolean(currentUser?.role?.canManageUsers);

  const loadUsers = async () => {
    try {
      const response = await fetchUsers();
      setUsers(response);
      setError(null);
    } catch (err) {
      setError('Unable to load users');
    }
  };

  const loadRoles = async () => {
    try {
      const response = await fetchRoles();
      setRoles(response);
    } catch (err) {
      setError('Unable to load roles');
    }
  };

  const loadBranches = async () => {
    try {
      const response = await fetchBranches();
      setBranches(response);
    } catch (err) {
      setError('Unable to load branches');
    }
  };

  useEffect(() => {
    if (!canManage) return;
    loadUsers();
    loadRoles();
    loadBranches();
  }, [canManage]);

  const handleChange = (field) => (event) => setForm({ ...form, [field]: event.target.value });

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
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        delete payload.username;
        await updateUser(editingId, payload);
        setSuccess('User updated successfully.');
      } else {
        await createUser(form);
        setSuccess('User created successfully.');
      }
      resetForm();
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save user');
    }
  };

  const editUser = (user) => {
    setEditingId(user.id);
    setForm({
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      password: '',
      roleId: user.roleId,
      branchId: user.branchId || '',
      status: user.status,
    });
  };

  const toggleStatus = async (user) => {
    setError(null);
    setSuccess(null);
    try {
      await updateUser(user.id, { status: user.status === 'Active' ? 'Inactive' : 'Active' });
      setSuccess(`User ${user.status === 'Active' ? 'deactivated' : 'activated'} successfully.`);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update user status');
    }
  };

  if (!canManage) {
    return (
      <div className="card">
        <h1>User Management</h1>
        <p className="muted">User management is restricted to roles with user administration permission.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>User Management</h1>
      <div className="card">
        <h2>{editingId ? 'Edit User' : 'Create New User'}</h2>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Username
            <input value={form.username} onChange={handleChange('username')} required disabled={Boolean(editingId)} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={handleChange('email')} required />
          </label>
          <label>
            Full Name
            <input value={form.fullName} onChange={handleChange('fullName')} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={handleChange('password')} required={!editingId} placeholder={editingId ? 'Leave blank to keep current password' : ''} />
          </label>
          <label>
            Role
            <select value={form.roleId} onChange={handleChange('roleId')} required>
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </label>
          <label>
            Branch
            <select value={form.branchId} onChange={handleChange('branchId')}>
              <option value="">Current/default branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={handleChange('status')}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Locked">Locked</option>
            </select>
          </label>
          {error && <div className="form-error">{error}</div>}
          {success && <div className="success-box">{success}</div>}
          <div className="actions-row">
            <button className="btn btn-primary" type="submit">{editingId ? 'Update User' : 'Create User'}</button>
            {editingId && <button className="btn btn-secondary" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>
      <div className="card">
        <h2>Current Users</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.fullName}</td>
                  <td>{user.email}</td>
                  <td>{user.role?.name}</td>
                  <td>{user.branch?.name || '-'}</td>
                  <td><span className="badge">{user.status}</span></td>
                  <td>
                    <div className="actions-row">
                      <button type="button" className="btn btn-secondary btn-compact" onClick={() => editUser(user)}>Edit</button>
                      <button type="button" className="btn btn-danger btn-compact" onClick={() => toggleStatus(user)} disabled={user.id === currentUser.id}>
                        {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
