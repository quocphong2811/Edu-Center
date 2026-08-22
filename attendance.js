import { $, showToast, getStudentsByClass, getStudentsCheckin, updateStudentCheckin, setButtonLoading, showTableLoading } from './common.js';

let studentAttendanceState = null;

function getStudentIdValue(student) {
  return Number(student?.studentId ?? student?.id ?? student?.student_id ?? 0);
}

function getStudentNameValue(student) {
  return student?.fullName ?? student?.studentFullName ?? student?.name ?? '—';
}

function normalizeAttendanceRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.students)) return payload.students;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function normalizeStatusValue(status) {
  if (status == null) return '';
  const rawStatus = String(status).trim();
  if (!rawStatus) return '';

  const upperStatus = rawStatus.toUpperCase();
  if (upperStatus === 'PRESENT' || upperStatus === 'ABSENT' || upperStatus === 'EXCUSED' || upperStatus === 'MAKEUP') {
    return upperStatus;
  }

  const lowerStatus = rawStatus.toLowerCase();
  if (lowerStatus === 'absent_excused') return 'EXCUSED';
  if (lowerStatus === 'absent_unexcused') return 'ABSENT';

  return '';
}

function getStatusForDate(studentId, date) {
  const byStudent = studentAttendanceState?.attendanceByStudent?.get(Number(studentId));
  if (!byStudent) return '';
  return byStudent.get(date) || '';
}

function setStatusForDate(studentId, date, status) {
  const studentKey = Number(studentId);
  if (!studentAttendanceState?.attendanceByStudent?.has(studentKey)) {
    studentAttendanceState.attendanceByStudent.set(studentKey, new Map());
  }
  studentAttendanceState.attendanceByStudent.get(studentKey).set(date, status);
}

function clearStatusForDate(studentId, date) {
  const studentKey = Number(studentId);
  const byStudent = studentAttendanceState?.attendanceByStudent?.get(studentKey);
  if (!byStudent) return;
  byStudent.delete(date);
  if (!byStudent.size) {
    studentAttendanceState.attendanceByStudent.delete(studentKey);
  }
}

function getDaysInMonth(month) {
  const [year, monthNum] = String(month || '').split('-').map(Number);
  if (!year || !monthNum) return 0;
  return new Date(year, monthNum, 0).getDate();
}

function buildDate(month, day) {
  return `${month}-${String(day).padStart(2, '0')}`;
}

const STATUS_ORDER = ['', 'PRESENT', 'EXCUSED', 'ABSENT', 'MAKEUP'];

function getNextStatus(status) {
  const currentIndex = STATUS_ORDER.indexOf(status || '');
  const nextIndex = (currentIndex + 1) % STATUS_ORDER.length;
  return STATUS_ORDER[nextIndex];
}

function getStatusLabel(status) {
  if (status === 'PRESENT') return '✓';
  if (status === 'EXCUSED') return 'P';
  if (status === 'ABSENT') return 'K';
  if (status === 'MAKEUP') return 'B';
  return '';
}

function getStatusTitle(status) {
  if (status === 'PRESENT') return 'Có mặt';
  if (status === 'EXCUSED') return 'Vắng có phép';
  if (status === 'ABSENT') return 'Vắng không phép';
  if (status === 'MAKEUP') return 'Học bù';
  return 'Chưa điểm danh';
}

function getStatusCellClass(status) {
  if (status === 'PRESENT') return 'present';
  if (status === 'EXCUSED') return 'absent-excused';
  if (status === 'ABSENT') return 'absent-unexcused';
  if (status === 'MAKEUP') return 'present';
  return 'not-set';
}

function getStudentAttendanceSummary(byDate) {
  const summary = {
    present: 0,
    excused: 0,
    absent: 0,
    makeup: 0,
  };

  if (!(byDate instanceof Map)) return summary;

  byDate.forEach((status) => {
    if (status === 'PRESENT') summary.present += 1;
    if (status === 'EXCUSED') summary.excused += 1;
    if (status === 'ABSENT') summary.absent += 1;
    if (status === 'MAKEUP') summary.makeup += 1;
  });

  return summary;
}

function renderSummaryChip(label, value, tone, title) {
  return `<span class="att-summary-chip ${tone}" title="${title}"><span>${label}</span><strong>${value}</strong></span>`;
}

function updateCellView(cell, status) {
  if (!cell) return;
  cell.className = `att-cell ${getStatusCellClass(status)}`;
  cell.textContent = getStatusLabel(status);
  cell.title = getStatusTitle(status);
}

function renderMonthlyAttendanceTable() {
  if (!studentAttendanceState) return;

  const classId = studentAttendanceState.classId;
  const month = studentAttendanceState.month;
  const dayCount = studentAttendanceState.dayCount;
  const days = Array.from({ length: dayCount }, (_, index) => index + 1);

  $('satt-content').innerHTML = `
    <div class="text-muted" style="margin-bottom:10px;font-size:12px;">Bấm vào ô để đổi trạng thái theo vòng: Chưa điểm danh → Có mặt → Vắng có phép → Vắng không phép → Học bù.</div>
    <div class="text-muted" style="margin-bottom:10px;font-size:12px;">Ký hiệu: ✓ Có mặt, P Vắng có phép, K Vắng không phép, B Học bù.</div>
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th style="position:sticky;left:0;background:var(--gray-50);z-index:1">Học viên</th>
            ${days.map((day) => `<th class="text-center" style="min-width:36px">${day}</th>`).join('')}
          </tr>
        </thead>
        <tbody id="satt-tbody"></tbody>
      </table>
    </div>
    <div class="mt-16 flex gap-8">
      <button class="btn btn-success" onclick="saveStudentAtt(event)">✓ Lưu điểm danh tháng</button>
    </div>
  `;

  $('satt-tbody').innerHTML = studentAttendanceState.students.map((student) => {
    const summary = getStudentAttendanceSummary(studentAttendanceState.attendanceByStudent.get(student.studentId));
    const cells = days.map((day) => {
      const date = buildDate(month, day);
      const status = getStatusForDate(student.studentId, date);
      const className = getStatusCellClass(status);
      const label = getStatusLabel(status);
      const title = getStatusTitle(status);
      return `<td class="text-center"><div class="att-cell ${className}" data-student-id="${student.studentId}" data-date="${date}" title="${title}" onclick="toggleStudentAttStatus(${student.studentId}, '${date}')">${label}</div></td>`;
    }).join('');

    const summaryHtml = [
      renderSummaryChip('Đã học', summary.present + summary.makeup, 'blue', 'Số buổi đã hoàn thành, gồm có mặt và học bù'),
      renderSummaryChip('Vắng phép', summary.excused, 'yellow', 'Số buổi vắng có phép'),
      renderSummaryChip('Vắng KP', summary.absent, 'red', 'Số buổi vắng không phép'),
      renderSummaryChip('Học bù', summary.makeup, 'green', 'Số buổi học bù'),
    ].join('');

    return `
      <tr>
        <td class="fw-600" style="position:sticky;left:0;background:#fff;z-index:1;min-width:240px;vertical-align:top;">
          <div>${student.fullName}</div>
          <div class="att-summary" aria-label="Tóm tắt điểm danh">${summaryHtml}</div>
        </td>
        ${cells}
      </tr>
    `;
  }).join('');
}

async function loadStudentAtt(event) {
  setButtonLoading(event, true, 'Đang tải...');
  $('satt-content').innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>Học viên</th></tr></thead><tbody id="satt-loading-tbody"></tbody></table></div>';
  showTableLoading('satt-loading-tbody', 1, 'Đang tải điểm danh...');
  const classId = Number($('satt-class-select')?.value || 0);
  const month = String($('satt-month')?.value || '').trim();
  if (!classId || !month) {
    setButtonLoading(event, false);
    return showToast('Chọn lớp và tháng!', 'error');
  }

  try {
    const [studentsInClass, checkinPayload] = await Promise.all([
      getStudentsByClass(classId),
      getStudentsCheckin(classId, month),
    ]);

    const students = (studentsInClass || []).map((student) => ({
      studentId: getStudentIdValue(student),
      fullName: getStudentNameValue(student),
    })).filter((student) => student.studentId > 0);

    if (!students.length) {
      showToast('Lớp chưa có học viên!', 'error');
      return;
    }

    const attendanceByStudent = new Map();
    const attendanceRows = normalizeAttendanceRows(checkinPayload);
    attendanceRows.forEach((row) => {
      const studentId = Number(row?.studentId ?? row?.id ?? row?.student_id ?? 0);
      if (!studentId) return;
      const byDate = new Map();
      const attendances = Array.isArray(row?.attendances) ? row.attendances : [];
      attendances.forEach((attendance) => {
        const attDate = attendance?.date;
        const attStatus = normalizeStatusValue(attendance?.status);
        if (typeof attDate === 'string' && attStatus) {
          byDate.set(attDate, attStatus);
        }
      });
      attendanceByStudent.set(studentId, byDate);
    });

    studentAttendanceState = {
      classId,
      month,
      dayCount: getDaysInMonth(month),
      students,
      attendanceByStudent,
    };
  } catch (err) {
    showToast(err?.message || 'Không thể tải điểm danh học viên', 'error');
    return;
  } finally {
    setButtonLoading(event, false);
  }

  renderMonthlyAttendanceTable();

  showToast('Đã tải danh sách điểm danh học viên');
}

async function saveStudentAtt(event) {
  setButtonLoading(event, true, 'Đang lưu...');
  if (!studentAttendanceState) {
    setButtonLoading(event, false);
    showToast('Vui lòng tải danh sách điểm danh trước', 'error');
    return;
  }

  const selectedClassId = Number($('satt-class-select')?.value || 0);
  const selectedMonth = String($('satt-month')?.value || '').trim();
  if (!selectedClassId || !selectedMonth) {
    setButtonLoading(event, false);
    showToast('Chọn lớp và tháng trước khi lưu', 'error');
    return;
  }

  if (selectedClassId !== studentAttendanceState.classId || selectedMonth !== studentAttendanceState.month) {
    setButtonLoading(event, false);
    showToast('Dữ liệu điểm danh không khớp lớp hoặc tháng đang chọn', 'error');
    return;
  }

  const payload = {
    month: studentAttendanceState.month,
    classId: studentAttendanceState.classId,
    students: studentAttendanceState.students.map((student) => {
      const byDate = studentAttendanceState.attendanceByStudent.get(student.studentId) || new Map();
      const attendances = Array.from(byDate.entries())
        .map(([attDate, attStatus]) => ({ date: attDate, status: attStatus }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return {
        studentId: student.studentId,
        attendances,
      };
    }),
  };

  try {
    await updateStudentCheckin(payload);
    showToast('Đã lưu điểm danh tháng!');
    await loadStudentAtt();
  } catch (err) {
    showToast(err?.message || 'Không thể lưu điểm danh học viên', 'error');
  } finally {
    setButtonLoading(event, false);
  }
}

function toggleStudentAttStatus(studentId, date) {
  if (!studentAttendanceState) return;

  const currentStatus = getStatusForDate(studentId, date);
  const nextStatus = getNextStatus(currentStatus);

  if (!nextStatus) {
    clearStatusForDate(studentId, date);
  } else {
    setStatusForDate(studentId, date, nextStatus);
  }

  const cell = document.querySelector(`[data-student-id="${studentId}"][data-date="${date}"]`);
  updateCellView(cell, nextStatus);
}

Object.assign(window, { loadStudentAtt, saveStudentAtt, toggleStudentAttStatus });
export { loadStudentAtt, saveStudentAtt, toggleStudentAttStatus };