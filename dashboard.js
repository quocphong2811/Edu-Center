import { $, fmt, thisMonth, getListStudents, getListClasses, getTuitionRows, getReceiptRows, showToast } from './common.js';

function getClassIdValue(cls) {
  return Number(cls?.id ?? cls?.classId ?? cls?.class_id ?? 0);
}

function getClassNameValue(cls) {
  return cls?.className ?? cls?.class_name ?? cls?.name ?? '—';
}

function getClassTeacherValue(cls) {
  if (typeof cls?.teacherFullName === 'string' && cls.teacherFullName.trim()) return cls.teacherFullName;
  if (typeof cls?.teacher === 'string' && cls.teacher.trim()) return cls.teacher;
  if (Array.isArray(cls?.teachers) && cls.teachers.length) {
    return cls.teachers.map((t) => t?.teacherFullName ?? t?.fullName ?? t?.name ?? '').filter(Boolean).join(', ') || '—';
  }
  return '—';
}

function getClassRateValue(cls) {
  return Number(cls?.feePerDay ?? cls?.fee_per_day ?? cls?.rate ?? 0);
}

function getClassStudentCountValue(cls) {
  const totalStudents = Number(cls?.totalStudents ?? cls?.total_students ?? 0);
  return totalStudents > 0 ? totalStudents : 0;
}

function getStudentClassIds(student) {
  if (Array.isArray(student?.classIds)) {
    return student.classIds.map((id) => Number(id)).filter((id) => id > 0);
  }
  if (Array.isArray(student?.classes)) {
    return student.classes
      .map((cls) => Number(cls?.classId ?? cls?.id ?? cls?.class_id ?? 0))
      .filter((id) => id > 0);
  }
  const classId = Number(student?.classId ?? student?.class_id ?? 0);
  return classId > 0 ? [classId] : [];
}

function setDashboardFallback() {
  $('dash-students').textContent = '0';
  $('dash-classes').textContent = '0';
  $('dash-collected').textContent = fmt(0);
  $('dash-unpaid').textContent = '0';
  $('dash-unpaid-list').innerHTML = '<tr><td colspan="3" class="text-muted text-center">Không tải được dữ liệu</td></tr>';
  $('dash-chart').innerHTML = '';
  $('dash-classes-table').innerHTML = '<tr><td colspan="4" class="text-muted text-center">Không tải được dữ liệu</td></tr>';
}

async function renderDashboard() {
  const month = thisMonth();

  try {
    const [students, classes, tuitionRows, currentMonthReceipts] = await Promise.all([
      getListStudents(),
      getListClasses(),
      getTuitionRows(month),
      getReceiptRows(month),
    ]);

    $('dash-students').textContent = String(Array.isArray(students) ? students.length : 0);
    $('dash-classes').textContent = String(Array.isArray(classes) ? classes.length : 0);

    const totalCollected = (currentMonthReceipts || []).reduce((sum, row) => sum + Number(row?.paid || 0), 0);
    $('dash-collected').textContent = fmt(totalCollected);

    const unpaidRows = (tuitionRows || [])
      .filter((row) => row.status !== 'paid' && row.status !== 'no-data' && Number(row.remaining || 0) > 0)
      .sort((a, b) => Number(b.remaining || 0) - Number(a.remaining || 0));

    $('dash-unpaid').textContent = String(unpaidRows.length);

    $('dash-unpaid-list').innerHTML = unpaidRows.slice(0, 6).map((row) => {
      return `<tr><td class="fw-600">${row.studentName || '—'}</td><td>${row.className || '—'}</td><td class="badge badge-red">${fmt(row.remaining)}</td></tr>`;
    }).join('') || '<tr><td colspan="3" class="text-muted text-center">Tất cả đã nộp đủ 🎉</td></tr>';

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }

    const receiptRowsByMonth = await Promise.all(months.map((m) => getReceiptRows(m)));
    const vals = receiptRowsByMonth.map((rows) => rows.reduce((sum, row) => sum + Number(row?.paid || 0), 0));
    const maxV = Math.max(...vals, 1);
    $('dash-chart').innerHTML = months.map((m, i) => {
      const h = Math.max(4, Math.round((vals[i] / maxV) * 120));
      const lbl = m.slice(5) + '/' + m.slice(2, 4);
      return `<div class="chart-bar-item"><div class="chart-bar-val">${vals[i] > 0 ? (vals[i] / 1000000).toFixed(1) + 'M' : ''}</div><div class="chart-bar-fill" style="height:${h}px;background:${i === 5 ? 'var(--blue)' : 'var(--blue-mid)'}"></div><div class="chart-bar-label">${lbl}</div></div>`;
    }).join('');

    const studentCountByClassId = new Map();
    (students || []).forEach((student) => {
      const classIds = getStudentClassIds(student);
      classIds.forEach((classId) => {
        studentCountByClassId.set(classId, Number(studentCountByClassId.get(classId) || 0) + 1);
      });
    });

    $('dash-classes-table').innerHTML = (classes || []).map((cls) => {
      const classId = getClassIdValue(cls);
      const className = getClassNameValue(cls);
      const teacherName = getClassTeacherValue(cls);
      const rate = getClassRateValue(cls);
      const totalStudents = getClassStudentCountValue(cls) || Number(studentCountByClassId.get(classId) || 0);
      return `<tr><td class="fw-600">${className}</td><td>${teacherName}</td><td>${totalStudents}</td><td>${fmt(rate)}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="text-muted text-center">Chưa có lớp nào</td></tr>';
  } catch (err) {
    setDashboardFallback();
    showToast(err?.message || 'Không thể tải dữ liệu tổng quan', 'error');
  }
}

window.renderDashboard = renderDashboard;
export { renderDashboard };