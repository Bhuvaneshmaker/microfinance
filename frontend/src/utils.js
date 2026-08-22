export const allBranchRoles = ['Super Admin', 'Director', 'CEO / Managing Director'];

export function canViewAllBranches(user) {
  return allBranchRoles.includes(user?.role?.name);
}

export function formatMoney(value) {
  const numeric = Number(value || 0);
  return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

export function exportCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
