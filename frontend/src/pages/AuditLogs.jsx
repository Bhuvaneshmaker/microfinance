import { useEffect, useState } from 'react';
import { fetchAuditLogs, fetchBranches } from '../api';
import { useAuthContext } from '../context/AuthContext';
import { canViewAllBranches } from '../utils';

export default function AuditLogs() {
  const { user } = useAuthContext();
  const [logs, setLogs] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({ branchId: '', entityType: '', action: '' });
  const [error, setError] = useState(null);

  const loadLogs = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const response = await fetchAuditLogs(params);
      setLogs(response);
      setError(null);
    } catch (err) {
      setError('Failed to load audit logs');
    }
  };

  useEffect(() => {
    loadLogs();
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

  return (
    <div>
      <h1>Audit Logs</h1>
      <div className="card">
        <div className="table-toolbar">
          {canViewAllBranches(user) && (
            <select value={filters.branchId} onChange={handleFilterChange('branchId')}>
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          <input placeholder="Entity type" value={filters.entityType} onChange={handleFilterChange('entityType')} />
          <input placeholder="Action" value={filters.action} onChange={handleFilterChange('action')} />
          <button type="button" className="btn btn-secondary" onClick={loadLogs}>Apply</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Branch</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.user?.fullName || log.user?.username || 'System'}</td>
                  <td>{log.branch?.name || '-'}</td>
                  <td>{log.entityType}</td>
                  <td>{log.action}</td>
                  <td>{JSON.stringify(log.details)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>No audit logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {error && <div className="form-error">{error}</div>}
      </div>
    </div>
  );
}
