import { $, fmt, getListClasses, getTeachersByClassAndMonth, getStudentsByClass, updateTeacherCheckin, createTeacher, openModal, closeModal, showToast } from './common.js';

let teacherAttendanceState = null;
let isCreatingTeacher = false;

function getClassIdValue(cls) {
  return Number(cls?.classId ?? cls?.id ?? cls?.class_id ?? 0);
}

function getClassNameValue(cls) {
  return cls?.className ?? cls?.class_name ?? cls?.name ?? '—';
}

function getClassRateValue(cls) {
  return Number(cls?.feePerDay ?? cls?.fee_per_day ?? cls?.rate ?? 0);
}

function getTeacherNameValue(teacher) {
  return teacher?.fullName ?? teacher?.teacherFullName ?? teacher?.name ?? '—';
}

function getDaysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return 0;
  return new Date(year, monthNumber, 0).getDate();
}

function getTeacherCheckedCount(teacher) {
  return teacher.checkedDates.size;
}

function refreshTeacherSummary() {
  if (!teacherAttendanceState) {
    $('tatt-total').textContent = '0';
    $('tatt-tuition').textContent = fmt(0);
    return;
  }

  const classRate = getClassRateValue(teacherAttendanceState.classMeta);
  const studentCount = Number(teacherAttendanceState.studentCount || 0);
  const totalSessions = teacherAttendanceState.teachers.reduce((sum, teacher) => sum + getTeacherCheckedCount(teacher), 0);
  const totalTuition = totalSessions * classRate * studentCount;

  $('tatt-total').textContent = String(totalSessions);
  $('tatt-tuition').textContent = fmt(totalTuition);
}

function toggleTeacherDate(teacherId, date) {
  if (!teacherAttendanceState) return;

  const teacher = teacherAttendanceState.teachers.find((item) => Number(item.teacherId) === Number(teacherId));
  if (!teacher) return;

  if (teacher.checkedDates.has(date)) {
    teacher.checkedDates.delete(date);
  } else {
    teacher.checkedDates.add(date);
  }

  const cell = document.querySelector(`[data-teacher-id="${teacherId}"][data-date="${date}"]`);
  if (cell) {
    const isChecked = teacher.checkedDates.has(date);
    cell.className = `att-cell ${isChecked ? 'present' : 'absent-unexcused'}`;
    cell.title = `${date}${isChecked ? ' — Có dạy' : ' — Không dạy'}`;
  }

  const checkedCountEl = $(`tatt-teacher-count-${teacherId}`);
  if (checkedCountEl) {
    checkedCountEl.textContent = `✓ Có dạy: ${getTeacherCheckedCount(teacher)} buổi`;
  }

  refreshTeacherSummary();
}

function renderTeacherAttendance() {
  if (!teacherAttendanceState) {
    $('tatt-content').innerHTML = '<p class="text-muted text-center">Chọn lớp và tháng để xem điểm danh giáo viên.</p>';
    return;
  }

  const className = getClassNameValue(teacherAttendanceState.classMeta);
  const classRate = getClassRateValue(teacherAttendanceState.classMeta);
  const studentCount = Number(teacherAttendanceState.studentCount || 0);
  const dayNumbers = Array.from({ length: teacherAttendanceState.daysInMonth }, (_, i) => i + 1);

  const teacherBlocks = teacherAttendanceState.teachers.map((teacher) => {
    const checkedCount = getTeacherCheckedCount(teacher);

    const dayCells = dayNumbers.map((day) => {
      const date = `${teacherAttendanceState.month}-${String(day).padStart(2, '0')}`;
      const isChecked = teacher.checkedDates.has(date);
      return `<div class="att-cell ${isChecked ? 'present' : 'absent-unexcused'}" data-teacher-id="${teacher.teacherId}" data-date="${date}" title="${date}${isChecked ? ' — Có dạy' : ' — Không dạy'}" onclick="toggleTeacherAttDate(${teacher.teacherId}, '${date}')">${String(day).padStart(2, '0')}</div>`;
    }).join('');

    return `
      <div class="card" style="border:1px solid var(--gray-200);margin-bottom:12px;">
        <div class="card-body" style="padding:14px;">
          <div class="flex justify-between items-center flex-wrap" style="margin-bottom:10px;">
            <div class="fw-600">${getTeacherNameValue(teacher)}</div>
            <span class="badge badge-green" id="tatt-teacher-count-${teacher.teacherId}">✓ Có dạy: ${checkedCount} buổi</span>
          </div>
          <div class="att-grid">${dayCells}</div>
        </div>
      </div>
    `;
  }).join('');

  $('tatt-content').innerHTML = `
    <div class="mb-8"><strong>${className}</strong> — Sĩ số: ${studentCount} HV — HP/buổi: ${fmt(classRate)}</div>
    <p style="font-size:12px;color:var(--gray-500);margin-bottom:10px">Bấm vào ô ngày để đánh dấu giáo viên có/không dạy. <span style="color:var(--green)">■ Có dạy</span> <span style="color:var(--red)">■ Không dạy</span></p>
    ${teacherBlocks || '<p class="text-muted text-center">Không có giáo viên trong lớp/tháng này.</p>'}
  `;

  refreshTeacherSummary();
}

async function loadTeacherAtt() {
  const classId = Number($('tatt-class-select')?.value || 0);
  const month = $('tatt-month')?.value;
  if (!classId || !month) return showToast('Chọn lớp và tháng!', 'error');

  try {
    const [classes, teacherRows, studentsInClass] = await Promise.all([
      getListClasses(),
      getTeachersByClassAndMonth(classId, month),
      getStudentsByClass(classId),
    ]);

    const classMeta = classes.find((cls) => getClassIdValue(cls) === classId) || { classId };
    const teachers = (teacherRows || []).map((teacher) => ({
      teacherId: Number(teacher.teacherId),
      fullName: getTeacherNameValue(teacher),
      checkedDates: new Set((teacher.checkedDates || []).filter((date) => typeof date === 'string' && date.startsWith(month))),
    })).filter((teacher) => teacher.teacherId > 0);

    teacherAttendanceState = {
      classId,
      month,
      daysInMonth: getDaysInMonth(month),
      classMeta,
      studentCount: Array.isArray(studentsInClass) ? studentsInClass.length : 0,
      teachers,
    };

    renderTeacherAttendance();
    showToast('Đã tải điểm danh giáo viên');
  } catch (err) {
    showToast(err?.message || 'Không thể tải điểm danh giáo viên', 'error');
  }
}

async function saveTeacherAtt() {
  if (!teacherAttendanceState) {
    showToast('Vui lòng tải danh sách điểm danh trước', 'error');
    return;
  }

  const payload = {
    month: teacherAttendanceState.month,
    teachers: teacherAttendanceState.teachers.map((teacher) => ({
      teacherId: Number(teacher.teacherId),
      checkedDates: Array.from(teacher.checkedDates).sort(),
    })),
  };

  try {
    await updateTeacherCheckin(payload);
    showToast('Đã lưu điểm danh giáo viên!');
    await loadTeacherAtt();
  } catch (err) {
    showToast(err?.message || 'Không thể lưu điểm danh giáo viên', 'error');
  }
}

function openTeacherCreateModal() {
  if ($('tadd-name')) $('tadd-name').value = '';
  if ($('tadd-phone')) $('tadd-phone').value = '';
  openModal('modal-teacher-create');
}

async function saveTeacherFromAttendance() {
  if (isCreatingTeacher) return;

  const fullName = $('tadd-name')?.value?.trim() || '';
  const phoneNumber = $('tadd-phone')?.value?.trim() || '';

  if (!fullName) {
    showToast('Vui lòng điền họ tên giáo viên!', 'error');
    return;
  }

  isCreatingTeacher = true;

  try {
    await createTeacher({
      fullName,
      phoneNumber: phoneNumber || undefined,
    });
    closeModal('modal-teacher-create');
    showToast('Đã thêm giáo viên mới!');
  } catch (err) {
    showToast(err?.message || 'Không thể thêm giáo viên', 'error');
  } finally {
    isCreatingTeacher = false;
  }
}

Object.assign(window, { loadTeacherAtt, saveTeacherAtt, toggleTeacherAttDate: toggleTeacherDate, openTeacherCreateModal, saveTeacherFromAttendance });
export { loadTeacherAtt, saveTeacherAtt, openTeacherCreateModal, saveTeacherFromAttendance };