import { $, fmt, showToast, getReceiptRows } from './common.js';

async function filterReceipts() {
  const q = ($('rc-search')?.value || '').toLowerCase();
  const month = $('rc-filter-month')?.value || '';

  let rows = [];
  try {
    rows = await getReceiptRows(month, q);
  } catch (err) {
    $('receipt-table').innerHTML = '<tr><td colspan="9" class="text-muted text-center">Không tải được lịch sử phiếu thu</td></tr>';
    showToast(err?.message || 'Không thể tải lịch sử phiếu thu', 'error');
    return;
  }

  const list = rows
    .filter((row) => {
      const name = String(row.studentName || '').toLowerCase();
      return (!month || row.month === month) && (!q || name.includes(q));
    })
    .sort((a, b) => {
      const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCompare !== 0) return dateCompare;
      return Number(b.id || 0) - Number(a.id || 0);
    });

  $('receipt-table').innerHTML = list.map((r) => {
    const receiptCode = r.id > 0 ? `#${String(r.id).padStart(4, '0')}` : '—';
    return `<tr><td class="badge badge-blue">${receiptCode}</td><td>${r.date || '—'}</td><td class="fw-600">${r.studentName || '—'}</td><td>${r.className || '—'}</td><td>${r.month || '—'}</td><td>${fmt(r.required)}</td><td style="color:var(--green)">${fmt(r.paid)}</td><td style="color:${r.remaining > 0 ? 'var(--red)' : 'var(--gray-400)'}">${r.remaining > 0 ? fmt(r.remaining) : 'Đủ'}</td><td style="color:var(--gray-500)">${r.note || '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="9" class="text-muted text-center">Chưa có phiếu thu</td></tr>';
}

Object.assign(window, { filterReceipts });
export { filterReceipts };
