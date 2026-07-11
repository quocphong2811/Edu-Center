import { $, fmt, getTuitionRows, showToast, createReceiptApi } from './common.js';

let lastRenderedRows = [];
let isSavingPayment = false;

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function getCachedRow(studentId, month) {
  return lastRenderedRows.find((row) => row.studentId === Number(studentId) && row.month === month) || null;
}

async function renderTuition() {
  const month = $('t-month').value || new Date().toISOString().slice(0, 7);
  const classFilter = $('t-filter-class').value;
  const classFilterNum = Number(classFilter || 0);
  const statusFilter = $('t-filter-status').value;

  try {
    const rowsFromApi = await getTuitionRows(month, classFilter);
    const normalizedRows = rowsFromApi
      .map((row) => ({ ...row, month }))
      .filter((row) => {
        if (!classFilterNum) return true;
        if (Number(row.classId || 0) === classFilterNum) return true;
        return Array.isArray(row.classIds) && row.classIds.includes(classFilterNum);
      });
    lastRenderedRows = normalizedRows;

    let paid = 0;
    let unpaid = 0;
    let totalPaid = 0;
    let totalOwed = 0;

    const rows = normalizedRows.map((row) => {
      if (statusFilter && row.status !== statusFilter) return null;

      if (row.status === 'paid') {
        paid++;
      } else if (row.status !== 'no-data') {
        unpaid++;
      }

      totalPaid += Number(row.paid || 0);
      totalOwed += Number(row.remaining || 0);

      const badge =
        row.status === 'paid'
          ? '<span class="badge badge-green">Đã nộp đủ</span>'
          : row.status === 'partial'
            ? '<span class="badge badge-yellow">Nộp một phần</span>'
            : row.status === 'unpaid'
              ? '<span class="badge badge-red">Chưa nộp</span>'
              : '<span class="badge badge-gray">Chưa có HP</span>';

      const rateText = Array.isArray(row.classRates) && row.classRates.length
        ? row.classRates.map((item) => `${fmt(item.rate)}`).join(', ')
        : fmt(row.rate);

      return `<tr><td class="fw-600">${row.studentName}</td><td>${row.className || '—'}</td><td>${row.sessions}</td><td>${rateText}</td><td class="fw-600">${fmt(row.required)}</td><td style="color:var(--green)">${fmt(row.paid)}</td><td style="color:var(--red);font-weight:${row.remaining > 0 ? 600 : 400}">${row.remaining > 0 ? fmt(row.remaining) : '—'}</td><td>${badge}</td><td>${row.required > 0 && row.remaining > 0 ? `<button class="btn btn-success btn-xs" onclick="openPaymentModal(${row.studentId},'${month}',${row.required})">💳 Thu tiền</button>` : ''}</td></tr>`;
    }).filter(Boolean);

    setText('t-paid', paid);
    setText('t-unpaid', unpaid);
    setText('t-total', fmt(totalPaid));
    setText('t-owed', fmt(totalOwed));
    $('tuition-table').innerHTML = rows.join('') || '<tr><td colspan="9" class="text-muted text-center">Không có dữ liệu</td></tr>';
  } catch (err) {
    setText('t-paid', '0');
    setText('t-unpaid', '0');
    setText('t-total', fmt(0));
    setText('t-owed', fmt(0));
    $('tuition-table').innerHTML = '<tr><td colspan="9" class="text-muted text-center">Không tải được dữ liệu học phí</td></tr>';
    showToast(err?.message || 'Không thể tải dữ liệu học phí', 'error');
  }
}

function openPaymentModal(studentId, month, required) {
  const row = getCachedRow(studentId, month);
  const paid = Number(row?.paid || 0);
  const fallbackRemaining = Math.max(0, Number(required || 0) - paid);

  $('pay-student-id').value = studentId;
  $('pay-name').value = row?.studentName || `HV #${studentId}`;
  $('pay-month').value = month;
  $('pay-required').value = fmt(row?.remaining ?? fallbackRemaining) + ' (còn thiếu)';
  $('pay-amount').value = '';
  if ($('pay-note')) $('pay-note').value = '';
  window.openModal?.('modal-payment');
}

async function savePayment() {
  if (isSavingPayment) return;

  const studentId = +$('pay-student-id').value;
  const month = $('pay-month').value;
  const amount = +$('pay-amount').value;
  const note = $('pay-note')?.value || '';
  if (!amount || amount <= 0) return showToast('Nhập số tiền hợp lệ!', 'error');

  const row = getCachedRow(studentId, month);
  isSavingPayment = true;

  try {
    await createReceiptApi({
      studentId,
      month,
      paidFee: amount,
      note,
    });

    window.closeModal?.('modal-payment');
    showToast(`Đã ghi nhận thanh toán ${fmt(amount)} từ ${row?.studentName || `HV #${studentId}`}`);
    await renderTuition();
    await window.filterReceipts?.();
  } catch (err) {
    showToast(err?.message || 'Không thể ghi nhận thanh toán', 'error');
  } finally {
    isSavingPayment = false;
  }
}

window.renderTuition = renderTuition;
window.openPaymentModal = openPaymentModal;
window.savePayment = savePayment;
export { renderTuition, openPaymentModal, savePayment };