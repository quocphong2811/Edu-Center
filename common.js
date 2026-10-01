import { get as apiGet } from './api.js';
import { post as apiPost } from './api.js';
import { put as apiPut } from './api.js';
import { del as apiDelete } from './api.js';

const SUPABASE_URL = 'https://vmthdbkpnejquzwinjnd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z2BL69bkYGki5wDvagVZGQ_bpFowUVR';

export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export const $ = (id) => document.getElementById(id);
export const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
export const fmtN = (n) => Number(n || 0).toLocaleString('vi-VN');
export const today = () => new Date().toISOString().slice(0, 10);
export const thisMonth = () => new Date().toISOString().slice(0, 7);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function setButtonLoading(target, isLoading, loadingText) {
  const rawTarget = target?.currentTarget ?? target?.target ?? target;
  const button = rawTarget instanceof HTMLButtonElement
    ? rawTarget
    : rawTarget instanceof Element
      ? rawTarget.closest('button')
      : null;

  if (!button || !(button instanceof HTMLButtonElement)) return;

  if (isLoading) {
    if (!button.dataset.loadingOriginalHtml) {
      button.dataset.loadingOriginalHtml = button.innerHTML;
    }

    const label = loadingText || button.dataset.loadingText || button.textContent.trim() || 'Đang xử lý...';
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span>`;
    return;
  }

  button.disabled = false;
  button.classList.remove('is-loading');

  if (button.dataset.loadingOriginalHtml) {
    button.innerHTML = button.dataset.loadingOriginalHtml;
    delete button.dataset.loadingOriginalHtml;
  }
}

export function showTableLoading(tableBodyId, colSpan, message = 'Đang tải dữ liệu...') {
  const tbody = $(tableBodyId);
  if (!tbody) return;

  const safeColSpan = Math.max(1, Number(colSpan) || 1);
  const safeMessage = escapeHtml(message);
  tbody.innerHTML = `<tr class="table-loading-row"><td colspan="${safeColSpan}" class="text-center"><span class="table-loading-inline"><span class="table-spinner" aria-hidden="true"></span><span>${safeMessage}</span></span></td></tr>`;
}

export function setModalLoading(modalId, isLoading, message = 'Đang tải dữ liệu...') {
  const overlayEl = $(modalId);
  if (!overlayEl) return;

  const modalEl = overlayEl.querySelector('.modal');
  if (!modalEl) return;

  let loadingMask = modalEl.querySelector('.modal-loading-mask');
  if (!loadingMask) {
    loadingMask = document.createElement('div');
    loadingMask.className = 'modal-loading-mask';
    loadingMask.innerHTML = '<div class="modal-loading-content"><span class="table-spinner" aria-hidden="true"></span><span class="modal-loading-message"></span></div>';
    modalEl.appendChild(loadingMask);
  }

  const loadingMessage = loadingMask.querySelector('.modal-loading-message');
  if (loadingMessage) {
    loadingMessage.textContent = message || 'Đang tải dữ liệu...';
  }

  if (isLoading) {
    modalEl.classList.add('is-loading');
    return;
  }

  modalEl.classList.remove('is-loading');
}

export function showToast(msg, type = 'success') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => {
    t.className = '';
  }, 2200);
}

export function openModal(id) {
  $(id)?.classList.add('open');
}

export function closeModal(id) {
  $(id)?.classList.remove('open');
}

export function getClassName(id) {
  const cls = getClass(id);
  return cls ? cls.name : '—';
}

export function normalizeStudent(student) {
  return {
    ...student,
    name: student.name ?? student.fullName ?? '',
    phone: student.phone ?? student.personalPhone ?? '',
    personalPhone: student.personalPhone ?? student.parentPhone ?? '',
  };
}

const pageTitles = {
  dashboard: 'Tổng quan',
  students: 'Học viên',
  classes: 'Lớp học',
  'teacher-att': 'Điểm danh Giáo viên',
  'student-att': 'Điểm danh Học viên',
  homework: 'Bài tập & Học bài',
  tuition: 'Học phí',
  receipts: 'Phiếu thu',
  reports: 'Báo cáo Doanh thu',
};

export function setPage(page) {
  document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
  document.querySelectorAll('.page').forEach((pageEl) => pageEl.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  $('page-' + page)?.classList.add('active');
  const title = $('page-title');
  if (title) title.textContent = pageTitles[page] || page;
}

export function switchTab(pageSelector, tabPaneId, btn) {
  document.querySelectorAll(`${pageSelector} .tab-pane`).forEach((pane) => pane.classList.remove('active'));
  document.querySelectorAll(`${pageSelector} .tab-btn`).forEach((tab) => tab.classList.remove('active'));
  $(tabPaneId)?.classList.add('active');
  btn?.classList.add('active');
}

export async function getListClasses(options = {}) {
  const res = await apiGet(`/functions/v1/get-list-classes`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch classes', res);

  return res;
}

export async function getClassById(id) {
  const res = await apiGet(`/functions/v1/get-class-by-id?id=${id}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch class', res);
  return res;
}

export async function getListTeachers(options = {}) {
  const res = await apiGet(`/functions/v1/get-list-teachers`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch teachers', res);

  return res;
}

export async function createTeacher(teacher) {
  const res = await apiPost(`/functions/v1/create-teacher`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
    body: { ...teacher },
  });
  if (!res) throw new Error('Failed to create teacher', res);

  return res;
}

export async function updateTeacher(teacher) {
  const payload = {
    id: Number(teacher?.id),
  };

  if (typeof teacher?.fullName === 'string') {
    payload.fullName = teacher.fullName;
  }

  if (Object.prototype.hasOwnProperty.call(teacher || {}, 'phoneNumber')) {
    payload.phoneNumber = teacher.phoneNumber;
  }

  if (Object.prototype.hasOwnProperty.call(teacher || {}, 'classIds')) {
    payload.classIds = teacher.classIds;
  }

  const res = await apiPut(`/functions/v1/update-teacher`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
    body: payload,
  });
  if (!res) throw new Error('Failed to update teacher', res);

  return res;
}

export async function deleteTeacher(teacherId, forceDelete = false) {
  const res = await apiDelete(`/functions/v1/delete-teacher?id=${teacherId}&force=${forceDelete}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to delete teacher', res);

  return res;
}

export async function createClass(classData) {
  const res = await apiPost(`/functions/v1/create-class`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
    body: classData,
  });
  if (!res) throw new Error('Failed to create class', res);

  return res;
}

export async function updateClass(classData) {
  const payload = {
    id: Number(classData?.id),
  };

  if (typeof classData?.className === 'string') {
    payload.className = classData.className;
  }

  if (typeof classData?.feePerDay === 'number' && Number.isFinite(classData.feePerDay)) {
    payload.feePerDay = classData.feePerDay;
  }

  if (Object.prototype.hasOwnProperty.call(classData || {}, 'timeTable')) {
    payload.timeTable = classData.timeTable;
  }

  if (Array.isArray(classData?.teacherIds)) {
    payload.teacherIds = classData.teacherIds
      .map((teacherId) => Number(teacherId))
      .filter((teacherId) => teacherId > 0);
  }

  if (Array.isArray(classData?.studentIds)) {
    payload.studentIds = classData.studentIds
      .map((studentId) => Number(studentId))
      .filter((studentId) => studentId > 0);
  }

  const res = await apiPut(`/functions/v1/update-class`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
    body: payload,
  });
  if (!res) throw new Error('Failed to update class', res);

  return res;
}

export async function deleteClass(classId) {
  const res = await apiDelete(`/functions/v1/delete-class?id=${classId}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to delete class', res);

  return res;
}

const STUDENT_PAGE_SIZE = 50;
const STUDENT_SCROLL_PREFETCH_PX = 48;
const rcStudentLazyStates = new WeakMap();

function normalizeStudentListPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.students)) return payload.students;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function getStudentFullName(student) {
  return student?.fullName ?? student?.studentFullName ?? student?.name ?? '—';
}

function getStudentClassId(student) {
  return student?.classId ?? student?.class_id ?? null;
}

function shouldLoadMoreOnScroll(el, threshold = STUDENT_SCROLL_PREFETCH_PX) {
  if (!el) return false;
  return el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
}

function getRcStudentLazyState(selectEl) {
  let state = rcStudentLazyStates.get(selectEl);
  if (state) return state;

  state = {
    isLoading: false,
    hasMore: true,
    offset: 0,
    version: 0,
    loadedIds: new Set(),
  };

  const onScroll = async () => {
    if (!shouldLoadMoreOnScroll(selectEl)) return;
    await loadMoreRcStudentOptions(selectEl, state);
  };

  selectEl.addEventListener('scroll', onScroll);
  state.onScroll = onScroll;
  rcStudentLazyStates.set(selectEl, state);
  return state;
}

async function loadMoreRcStudentOptions(selectEl, state) {
  if (!selectEl || state.isLoading || !state.hasMore) return;

  const requestVersion = state.version;
  state.isLoading = true;
  try {
    const payload = await getListStudents({
      limit: STUDENT_PAGE_SIZE,
      offset: state.offset,
    });

    if (requestVersion !== state.version) return;

    const students = normalizeStudentListPayload(payload);
    students.forEach((student) => {
      const studentId = Number(student?.id ?? student?.studentId ?? student?.student_id ?? 0);
      if (!studentId || state.loadedIds.has(studentId)) return;
      state.loadedIds.add(studentId);

      const label = `${getStudentFullName(student)} — ${getClassName(getStudentClassId(student))}`;
      selectEl.add(new Option(label, String(studentId)));
    });

    state.offset += students.length;
    state.hasMore = students.length === STUDENT_PAGE_SIZE;
  } finally {
    if (requestVersion === state.version) {
      state.isLoading = false;
    }
  }
}

export async function getListStudents(options = {}) {
  const limit = Number(options?.limit);
  const offset = Number(options?.offset);
  const query = new URLSearchParams();

  if (Number.isFinite(limit) && limit > 0) {
    query.set('limit', String(Math.trunc(limit)));
  }
  if (Number.isFinite(offset) && offset >= 0) {
    query.set('offset', String(Math.trunc(offset)));
  }

  const path = query.toString()
    ? `/functions/v1/get-list-students?${query.toString()}`
    : '/functions/v1/get-list-students';

  const res = await apiGet(path, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch students', res);

  return res;
}

export async function getStudentById(id) {
  const res = await apiGet(`/functions/v1/get-student-by-id?id=${id}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch students', res);
  return res;
}

export async function createStudent(student) {
    const res = await apiPost(`/functions/v1/create-student`, {
      headers: {
        apikey: SUPABASE_KEY,
      },
      body: student,
    });
    if (!res) throw new Error('Failed to create student', res);

    return res;
}

export async function updateStudent(student) {
  const payload = {
    id: Number(student?.id),
    fullName: String(student?.fullName || '').trim(),
    personalPhone: String(student?.personalPhone || '').trim(),
  };

  if (Object.prototype.hasOwnProperty.call(student || {}, 'parentPhone')) {
    payload.parentPhone = student.parentPhone;
  }

  if (Object.prototype.hasOwnProperty.call(student || {}, 'feeStatus')) {
    payload.feeStatus = student.feeStatus;
  }

  if (Object.prototype.hasOwnProperty.call(student || {}, 'classIds')) {
    payload.classIds = Array.isArray(student.classIds)
      ? student.classIds
        .map((classId) => Number(classId))
        .filter((classId) => classId > 0)
      : student.classIds;
  }

  const res = await apiPut(`/functions/v1/update-student`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
    body: payload,
  });
  if (!res) throw new Error('Failed to update student', res);

  return res;
}

export async function deleteStudent(studentId, forceDelete = false) {
  const res = await apiDelete(`/functions/v1/delete-student?id=${studentId}&force=${forceDelete}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to delete student', res);

  return res;
}

export async function getStudentsByClass(classId) {
  const res = await apiGet(`/functions/v1/get-list-students-by-class?class_id=${classId}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch students by class', res);

  return res;
}


export async function getStudentsByKeyword(keyword) {
  const res = await apiGet(`/functions/v1/get-students-by-keyword?keyword=${keyword}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch students by keyword', res);

  return res;
}

export async function getTeachersByClassAndMonth(classId, month) {
  const res = await apiGet(`/functions/v1/get-teachers-by-class-and-month?classId=${classId}&month=${month}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch teacher attendance', res);

  return res;
}

/**
 * @typedef {{
 *   month: string,
 *   teachers: Array<{
 *     teacherId: number,
 *     classes: Array<{
 *       classId: number,
 *       checkedDates: string[]
 *     }>
 *   }>
 * }} UpdateTeacherCheckinRequest
 *
 * @typedef {{
 *   success: boolean,
 *   month: string,
 *   teachers: Array<{
 *     teacherId: number,
 *     classes: Array<{
 *       classId: number,
 *       totalCheckinDays: number
 *     }>
 *   }>
 * }} UpdateTeacherCheckinResponse
 */

/**
 * @param {UpdateTeacherCheckinRequest} payload
 * @returns {Promise<UpdateTeacherCheckinResponse>}
 */
export async function updateTeacherCheckin(payload) {
  const res = await apiPut(`/functions/v1/update-teacher-checkin`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
    body: payload,
  });
  if (!res) throw new Error('Failed to update teacher attendance', res);

  return res;
}

export async function getStudentsCheckin(classId, month) {
  const res = await apiGet(`/functions/v1/get-students-checkin?classId=${classId}&month=${month}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch student attendance', res);

  return res;
}

export async function updateStudentCheckin(payload) {
  const res = await apiPut(`/functions/v1/update-student-checkin`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
    body: payload,
  });
  if (!res) throw new Error('Failed to update student attendance', res);

  return res;
}

export async function getStudentsHomework(classId, month) {
  const res = await apiGet(`/functions/v1/get-students-homework?classId=${classId}&month=${month}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch students homework', res);

  return res;
}

export async function updateStudentsHomework(payload) {
  const res = await apiPut(`/functions/v1/update-students-homework`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
    body: payload,
  });
  if (!res) throw new Error('Failed to update students homework', res);

  return res;
}

export async function getStudentAbsenceReport(classId, month) {
  const classQuery = classId ? `classId=${classId}&` : '';
  const res = await apiGet(`/functions/v1/student-absence-report?${classQuery}month=${month}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch student absence report', res);

  return res;
}

export function normalizeTuitionStatus(value, required, paid, remaining) {
  const raw = String(value || '').trim().toLowerCase();
  const statusMap = {
    paid: 'paid',
    full_paid: 'paid',
    fully_paid: 'paid',
    completed: 'paid',
    partial: 'partial',
    part_paid: 'partial',
    partially_paid: 'partial',
    unpaid: 'unpaid',
    not_paid: 'unpaid',
    pending: 'unpaid',
    no_data: 'no-data',
    nodata: 'no-data',
    none: 'no-data',
  };

  if (statusMap[raw]) return statusMap[raw];
  if (!required || required <= 0) return 'no-data';
  if ((remaining || 0) <= 0) return 'paid';
  if ((paid || 0) > 0) return 'partial';
  return 'unpaid';
}

export function normalizeTuitionRow(row) {
  const classes = Array.isArray(row?.classes) ? row.classes : [];
  const classIds = classes
    .map((cls) => Number(cls?.classId ?? cls?.id ?? cls?.class_id ?? 0))
    .filter((id) => id > 0);
  const classNames = classes
    .map((cls) => cls?.className ?? cls?.name ?? cls?.class_name ?? '')
    .filter((name) => typeof name === 'string' && name.trim());
  const classRates = classes
    .map((cls) => {
      const className = String(cls?.className ?? cls?.name ?? cls?.class_name ?? '').trim();
      const rate = Number(cls?.feePerDay ?? cls?.rate ?? cls?.fee_per_day ?? 0);
      if (!className || rate <= 0) return null;
      return { className, rate };
    })
    .filter(Boolean);

  const studentId = Number(row?.studentId ?? row?.student_id ?? row?.id ?? row?.student?.id ?? 0);
  const classId = Number(row?.classId ?? row?.class_id ?? row?.class?.id ?? classIds[0] ?? 0);

  const sessions = Number(
    row?.sessions
      ?? row?.totalAttendanceDays
      ?? row?.attendanceDays
      ?? row?.totalSessions
      ?? row?.sessionCount
      ?? row?.session_count
      ?? classes.reduce((sum, cls) => sum + Number(cls?.attendanceDays ?? 0), 0)
      ?? 0
  );

  const totalFee = Number(
    row?.totalFee
      ?? row?.required
      ?? row?.requiredAmount
      ?? row?.required_amount
      ?? row?.totalRequired
      ?? classes.reduce((sum, cls) => sum + Number(cls?.totalFee ?? 0), 0)
      ?? 0
  );
  const discount = Number(row?.discount ?? row?.discountFee ?? 0);
  const otherFee = Number(row?.otherFee ?? row?.additionalFee ?? 0);

  const paid = Number(
    row?.paid
      ?? row?.paidFee
      ?? row?.paidAmount
      ?? row?.paid_amount
      ?? row?.collected
      ?? row?.totalPaid
      ?? 0
  );

  const requiredRaw = row?.required ?? row?.requiredAmount ?? row?.required_amount ?? row?.totalRequired;
  const required = Number(
    requiredRaw != null
      ? requiredRaw
      : Math.max(0, totalFee - discount + otherFee)
  );

  const remainingRaw = row?.remaining ?? row?.remainingFee ?? row?.remainingAmount ?? row?.remaining_amount ?? row?.owed ?? row?.debt;
  const remaining = Number(remainingRaw != null ? remainingRaw : Math.max(0, required - paid));
  const creditBalance = Number(
    row?.creditBalance
      ?? row?.credit_balance
      ?? row?.prepaidBalance
      ?? row?.prepaid_balance
      ?? row?.advanceBalance
      ?? row?.advance_balance
      ?? 0
  );

  const singleClassRate = classes.length === 1 ? Number(classes[0]?.feePerDay ?? classes[0]?.rate ?? 0) : 0;
  const calculatedRate = sessions > 0 ? Math.round(totalFee / sessions) : 0;
  const fallbackRate = singleClassRate ?? calculatedRate ?? 0;
  const rate = Number(row?.rate ?? row?.feePerDay ?? row?.fee_per_day ?? row?.tuitionPerSession ?? fallbackRate);

  return {
    studentId,
    studentName: row?.studentName ?? row?.student_name ?? row?.fullName ?? row?.name ?? row?.student?.fullName ?? row?.student?.name ?? '—',
    classId,
    classIds,
    className: row?.className ?? row?.class_name ?? row?.class?.className ?? row?.class?.name ?? (classNames.length ? classNames.join(', ') : '—'),
    classRates,
    sessions,
    rate,
    required,
    paid,
    remaining,
    creditBalance,
    status: normalizeTuitionStatus(row?.status ?? row?.paymentStatus ?? row?.payment_status, required, paid, remaining),
  };
}

export function normalizeTuitionRows(payload) {
  const list =
    (Array.isArray(payload) && payload) ||
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.items) && payload.items) ||
    (Array.isArray(payload?.rows) && payload.rows) ||
    (Array.isArray(payload?.students) && payload.students) ||
    (Array.isArray(payload?.tuition) && payload.tuition) ||
    [];

  return list.map(normalizeTuitionRow).filter((item) => item.studentId > 0);
}

export async function getTuitionRows(month, classId) {
  const classQuery = classId ? `&classId=${classId}` : '';
  const res = await apiGet(`/functions/v1/get-tuition-fees?month=${month}${classQuery}`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch tuition rows', res);

  return normalizeTuitionRows(res);
}

export function normalizeReceiptRow(row) {
  const required = Number(row?.required ?? row?.requiredAmount ?? row?.required_amount ?? 0);
  const paid = Number(row?.paid ?? row?.paidAmount ?? row?.paid_amount ?? 0);
  const remainingRaw = row?.remaining ?? row?.remainingAmount ?? row?.remaining_amount;
  const remaining = Number(remainingRaw != null ? remainingRaw : Math.max(0, required - paid));

  return {
    id: Number(row?.id ?? row?.receiptId ?? row?.receipt_id ?? 0),
    studentId: Number(row?.studentId ?? row?.student_id ?? row?.student?.id ?? 0),
    studentName: row?.studentName ?? row?.student_name ?? row?.fullName ?? row?.name ?? row?.student?.fullName ?? row?.student?.name ?? '—',
    className: row?.className ?? row?.class_name ?? row?.class?.className ?? row?.class?.name ?? '—',
    month: row?.month ?? row?.tuitionMonth ?? row?.tuition_month ?? '',
    required,
    paid,
    remaining,
    note: row?.note ?? row?.notes ?? '',
    date: row?.date ?? row?.createdAt ?? row?.created_at ?? '',
  };
}

export function normalizeReceiptRows(payload) {
  const list =
    (Array.isArray(payload) && payload) ||
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.items) && payload.items) ||
    (Array.isArray(payload?.rows) && payload.rows) ||
    (Array.isArray(payload?.receipts) && payload.receipts) ||
    [];

  return list.map(normalizeReceiptRow).filter((item) => item.studentId > 0);
}

export async function getReceiptRows(month = '', keyword = '') {
  const query = new URLSearchParams();
  if (month) query.set('month', month);
  if (keyword) query.set('keyword', keyword);

  const path = query.toString() ? `/functions/v1/get-receipts?${query.toString()}` : '/functions/v1/get-receipts';
  const res = await apiGet(path, {
    headers: {
      apikey: SUPABASE_KEY,
    },
  });
  if (!res) throw new Error('Failed to fetch receipts', res);

  return normalizeReceiptRows(res);
}

export function normalizeCreateReceiptBody(payload = {}) {
  const studentId = Number(payload?.studentId ?? payload?.student_id ?? 0);
  const month = String(payload?.month ?? '').trim();
  const paidFee = Number(payload?.paidFee ?? payload?.paid_fee ?? payload?.paid ?? 0);
  const note = String(payload?.note ?? payload?.notes ?? '').trim();

  return {
    studentId,
    month,
    paidFee,
    note,
  };
}

export async function createReceiptApi(payload = {}) {
  const body = normalizeCreateReceiptBody(payload);
  if (!body.studentId || !body.month) {
    throw new Error('Thiếu thông tin học viên hoặc tháng học phí');
  }

  const res = await apiPost(`/functions/v1/create-receipt`, {
    headers: {
      apikey: SUPABASE_KEY,
    },
    body,
  });
  if (!res) throw new Error('Failed to create receipt', res);

  return res;
}

export async function populateClassSelects() {
  const selects = [
    'student-filter-class',
    'tatt-class-select',
    'satt-class-select',
    'satt-report-class',
    'hw-class-select',
    'hw-report-class',
    't-filter-class',
    'rc-student',
  ];

  for (const selId of selects) {
    const el = $(selId);
    if (!el || selId === 'rc-student') continue;
    const val = el.value;
    while (el.options.length > 1) el.remove(1);
    const classes = await getListClasses();
    classes.forEach((cls) => {
      const classId = cls.id ?? cls.class_id ?? cls.classId;
      const className = cls.class_name ?? cls.name ?? cls.className ?? '—';
      if (classId != null) {
        el.add(new Option(className, String(classId)));
      }
    });
    el.value = val;
  }

  const rcSel = $('rc-student');
  if (rcSel) {
    const val = rcSel.value;

    const lazyState = getRcStudentLazyState(rcSel);
    lazyState.version += 1;
    lazyState.isLoading = false;
    lazyState.hasMore = true;
    lazyState.offset = 0;
    lazyState.loadedIds.clear();

    while (rcSel.options.length > 1) rcSel.remove(1);

    await loadMoreRcStudentOptions(rcSel, lazyState);
    rcSel.value = val;
  }
}

Object.assign(window, {
  supabaseClient,
  $,
  fmt,
  fmtN,
  today,
  thisMonth,
  setButtonLoading,
  showTableLoading,
  setModalLoading,
  showToast,
  openModal,
  closeModal,
  getStudentById,
  getClassName,
  normalizeStudent,
  populateClassSelects,
  setPage,
  switchTab,
  getListClasses,
  getClassById,
  getListTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getListStudents,
  createClass,
  updateClass,
  deleteClass,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentsByClass,
  getStudentsByKeyword,
  getTeachersByClassAndMonth,
  updateTeacherCheckin,
  getStudentsCheckin,
  updateStudentCheckin,
  getStudentsHomework,
  updateStudentsHomework,
  getStudentAbsenceReport,
  normalizeTuitionRows,
  normalizeTuitionStatus,
  getTuitionRows,
  normalizeReceiptRows,
  getReceiptRows,
  normalizeCreateReceiptBody,
  createReceiptApi,
});
