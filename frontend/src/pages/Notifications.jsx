import { useEffect, useState } from 'react';
import {
  createNotificationTemplate,
  fetchBranches,
  fetchNotificationTemplates,
  fetchNotifications,
  queueManualNotification,
  updateNotificationTemplate,
} from '../api';
import { useAuthContext } from '../context/AuthContext';
import { canViewAllBranches, formatDate } from '../utils';

const eventTypes = [
  'CustomerRegistration',
  'LoanApproval',
  'LoanRejection',
  'Disbursement',
  'PaymentReceived',
  'PaymentReminder',
  'OverdueNotice',
  'PasswordReset',
  'AccountNotice',
];

const emptyTemplate = { name: '', eventType: 'CustomerRegistration', templateBody: '', enabled: true };
const emptyManual = { eventType: 'AccountNotice', targetPhone: '', message: '', branchId: '' };

export default function Notifications() {
  const { user } = useAuthContext();
  const [notifications, setNotifications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({ status: '', eventType: '', branchId: '' });
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [manualForm, setManualForm] = useState(emptyManual);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const canManage = Boolean(user?.role?.canManageUsers);

  const loadNotifications = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const response = await fetchNotifications(params);
      setNotifications(response);
      setError(null);
    } catch (err) {
      setError('Failed to load notifications');
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetchNotificationTemplates();
      setTemplates(response);
    } catch (err) {
      setError('Failed to load notification templates');
    }
  };

  useEffect(() => {
    loadNotifications();
    loadTemplates();
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
  const handleTemplateChange = (field) => (event) => {
    const value = field === 'enabled' ? event.target.value === 'true' : event.target.value;
    setTemplateForm({ ...templateForm, [field]: value });
  };
  const handleManualChange = (field) => (event) => setManualForm({ ...manualForm, [field]: event.target.value });

  const saveTemplate = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (editingTemplateId) {
        await updateNotificationTemplate(editingTemplateId, templateForm);
        setSuccess('Notification template updated.');
      } else {
        await createNotificationTemplate(templateForm);
        setSuccess('Notification template created.');
      }
      setTemplateForm(emptyTemplate);
      setEditingTemplateId(null);
      loadTemplates();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save template');
    }
  };

  const editTemplate = (template) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      eventType: template.eventType,
      templateBody: template.templateBody,
      enabled: template.enabled,
    });
  };

  const sendManualNotification = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await queueManualNotification(manualForm);
      setManualForm(emptyManual);
      setSuccess('Manual notification queued.');
      loadNotifications();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to queue notification');
    }
  };

  return (
    <div>
      <h1>Notifications</h1>
      <div className="grid-col-2">
        {canManage && (
          <div className="card">
            <h2>{editingTemplateId ? 'Edit Template' : 'Create Template'}</h2>
            <form className="form-grid" onSubmit={saveTemplate}>
              <label>
                Name
                <input value={templateForm.name} onChange={handleTemplateChange('name')} required />
              </label>
              <label>
                Event
                <select value={templateForm.eventType} onChange={handleTemplateChange('eventType')}>
                  {eventTypes.map((eventType) => (
                    <option key={eventType} value={eventType}>{eventType}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={String(templateForm.enabled)} onChange={handleTemplateChange('enabled')}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </label>
              <label className="full-width">
                Message Template
                <textarea value={templateForm.templateBody} onChange={handleTemplateChange('templateBody')} rows="4" required />
              </label>
              <div className="actions-row">
                <button type="submit" className="btn btn-primary">{editingTemplateId ? 'Update Template' : 'Save Template'}</button>
                {editingTemplateId && <button type="button" className="btn btn-secondary" onClick={() => { setEditingTemplateId(null); setTemplateForm(emptyTemplate); }}>Cancel</button>}
              </div>
            </form>
          </div>
        )}
        {canManage && (
          <div className="card">
            <h2>Manual SMS Queue</h2>
            <form className="form-grid" onSubmit={sendManualNotification}>
              <label>
                Event
                <select value={manualForm.eventType} onChange={handleManualChange('eventType')}>
                  {eventTypes.map((eventType) => (
                    <option key={eventType} value={eventType}>{eventType}</option>
                  ))}
                </select>
              </label>
              {canViewAllBranches(user) && (
                <label>
                  Branch
                  <select value={manualForm.branchId} onChange={handleManualChange('branchId')}>
                    <option value="">Default branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Target Phone
                <input value={manualForm.targetPhone} onChange={handleManualChange('targetPhone')} required />
              </label>
              <label className="full-width">
                Message
                <textarea value={manualForm.message} onChange={handleManualChange('message')} rows="4" required />
              </label>
              <button type="submit" className="btn btn-primary">Queue SMS</button>
            </form>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h2>Templates</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Event</th>
                <th>Status</th>
                <th>Body</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{template.eventType}</td>
                  <td><span className="badge">{template.enabled ? 'Enabled' : 'Disabled'}</span></td>
                  <td>{template.templateBody}</td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-secondary btn-compact" onClick={() => editTemplate(template)}>Edit</button>
                    </td>
                  )}
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} style={{ textAlign: 'center' }}>No templates found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h2>Notification Queue</h2>
        <div className="table-toolbar">
          <select value={filters.status} onChange={handleFilterChange('status')}>
            <option value="">Any status</option>
            <option value="Pending">Pending</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
          </select>
          <select value={filters.eventType} onChange={handleFilterChange('eventType')}>
            <option value="">Any event</option>
            {eventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>{eventType}</option>
            ))}
          </select>
          {canViewAllBranches(user) && (
            <select value={filters.branchId} onChange={handleFilterChange('branchId')}>
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-secondary" type="button" onClick={loadNotifications}>Apply</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Event</th>
                <th>Branch</th>
                <th>Target</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id}>
                  <td>{formatDate(notification.createdAt)}</td>
                  <td>{notification.eventType}</td>
                  <td>{notification.branch?.name || '-'}</td>
                  <td>{notification.targetPhone}</td>
                  <td><span className="badge">{notification.status}</span></td>
                  <td>{formatDate(notification.sentAt)}</td>
                  <td>{notification.message}</td>
                </tr>
              ))}
              {notifications.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>No notifications found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {error && <div className="form-error" style={{ marginTop: '16px' }}>{error}</div>}
      {success && <div className="success-box" style={{ marginTop: '16px' }}>{success}</div>}
    </div>
  );
}
