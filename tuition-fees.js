import { $, fmt, getTuitionRows, showToast, createReceiptApi, getListClasses, setButtonLoading, showTableLoading } from './common.js';

let lastRenderedRows = [];
let isSavingPayment = false;

const DEFAULT_TUITION_EMPTY_MESSAGE = 'Chọn lớp để xem học phí';
const NO_CLASS_TUITION_EMPTY_MESSAGE = 'Chưa có lớp nào để hiển thị học phí';

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function getCachedRow(studentId, month) {
  return lastRenderedRows.find((row) => row.studentId === Number(studentId) && row.month === month) || null;
}

function setTuitionSummaryDefaults() {
  setText('t-paid', '0');
  setText('t-unpaid', '0');
  setText('t-total', fmt(0));
  setText('t-owed', fmt(0));
}

function renderTuitionEmptyState(message = DEFAULT_TUITION_EMPTY_MESSAGE) {
  lastRenderedRows = [];
  setTuitionSummaryDefaults();
  $('tuition-table').innerHTML = `<tr><td colspan="9" class="text-muted text-center">${message}</td></tr>`;
}

async function syncTuitionFilterSelection({ preferredClassId = null, autoSelectFirstClass = true } = {}) {
  const filterEl = $('t-filter-class');
  if (!filterEl) return { classId: null, hasClasses: false };

  const classes = await getListClasses();
  const classIds = classes
    .map((cls) => String(cls?.id ?? cls?.class_id ?? cls?.classId ?? '').trim())
    .filter(Boolean);

  const currentClassId = String(filterEl.value || '').trim();
  const preferredId = preferredClassId == null || preferredClassId === '' ? null : String(preferredClassId);

  let targetClassId = classIds.includes(currentClassId) ? currentClassId : null;
  if (!targetClassId && preferredId && classIds.includes(preferredId)) {
    targetClassId = preferredId;
  }
  if (!targetClassId && autoSelectFirstClass && classIds.length) {
    targetClassId = classIds[0];
  }

  filterEl.value = targetClassId || '';
  return { classId: targetClassId, hasClasses: classIds.length > 0 };
}

async function initializeTuitionPage() {
  const selectedMonth = $('t-month')?.value || new Date().toISOString().slice(0, 7);
  if ($('t-month')) $('t-month').value = selectedMonth;

  const { classId, hasClasses } = await syncTuitionFilterSelection();
  if (!classId) {
    renderTuitionEmptyState(hasClasses ? DEFAULT_TUITION_EMPTY_MESSAGE : NO_CLASS_TUITION_EMPTY_MESSAGE);
    return;
  }

  await renderTuition();
}

async function renderTuition(event) {
  setButtonLoading(event, true, 'Đang tải...');
  showTableLoading('tuition-table', 9, 'Đang tải học phí...');
  const month = $('t-month').value || new Date().toISOString().slice(0, 7);
  const classFilter = $('t-filter-class')?.value;
  if (!classFilter) {
    const classes = await getListClasses();
    renderTuitionEmptyState(classes.length ? DEFAULT_TUITION_EMPTY_MESSAGE : NO_CLASS_TUITION_EMPTY_MESSAGE);
    setButtonLoading(event, false);
    return;
  }

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
    setTuitionSummaryDefaults();
    $('tuition-table').innerHTML = '<tr><td colspan="9" class="text-muted text-center">Không tải được dữ liệu học phí</td></tr>';
    showToast(err?.message || 'Không thể tải dữ liệu học phí', 'error');
  } finally {
    setButtonLoading(event, false);
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

async function savePayment(event) {
  if (isSavingPayment) return;

  const studentId = +$('pay-student-id').value;
  const month = $('pay-month').value;
  const amount = +$('pay-amount').value;
  const note = $('pay-note')?.value || '';
  if (!amount || amount <= 0) return showToast('Nhập số tiền hợp lệ!', 'error');

  const row = getCachedRow(studentId, month);
  isSavingPayment = true;
  setButtonLoading(event, true, 'Đang xác nhận...');

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
    setButtonLoading(event, false);
  }
}

window.renderTuition = renderTuition;
window.initializeTuitionPage = initializeTuitionPage;
window.openPaymentModal = openPaymentModal;
window.savePayment = savePayment;
export { initializeTuitionPage, renderTuition, openPaymentModal, savePayment };