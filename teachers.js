import { $, fmt, getListClasses, getListTeachers, getTeachersByClassAndMonth, getStudentsByClass, updateTeacherCheckin, createTeacher, updateTeacher, deleteTeacher, openModal, closeModal, showToast, setButtonLoading, showTableLoading } from './common.js';

let teacherAttendanceState = null;
let isCreatingTeacher = false;
let isSavingTeacherEdit = false;
let teacherManagementRows = [];

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

function getTeacherIdValue(teacher) {
  return Number(teacher?.teacherId ?? teacher?.id ?? teacher?.teacher_id ?? 0);
}

function getTeacherPhoneValue(teacher) {
  return teacher?.phoneNumber ?? teacher?.phone ?? teacher?.teacherPhone ?? '';
}

function getTeacherClassDisplay(teacher) {
  if (Array.isArray(teacher?.classes) && teacher.classes.length) {
    return teacher.classes
      .map((cls) => cls?.className ?? cls?.name ?? cls?.class_name ?? '')
      .filter(Boolean)
      .join(', ') || '—';
  }

  if (Array.isArray(teacher?.classNames) && teacher.classNames.length) {
    return teacher.classNames.filter(Boolean).join(', ') || '—';
  }

  return '—';
}

function getDaysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return 0;
  return new Date(year, monthNumber, 0).getDate();
}

function getTeacherCheckedCount(teacher) {
  if (Number.isFinite(Number(teacher?.confirmedTotalCheckinDays))) {
    return Number(teacher.confirmedTotalCheckinDays);
  }
  return teacher?.checkedDates instanceof Set ? teacher.checkedDates.size : 0;
}

function refreshTeacherSummary() {
  if (!teacherAttendanceState) {
    $('tatt-total').textContent = '0';
    return;
  }

  const classRate = getClassRateValue(teacherAttendanceState.classMeta);
  const studentCount = Number(teacherAttendanceState.studentCount || 0);
  const totalSessions = teacherAttendanceState.teachers.reduce((sum, teacher) => sum + getTeacherCheckedCount(teacher), 0);

  $('tatt-total').textContent = String(totalSessions);
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
  teacher.confirmedTotalCheckinDays = null;

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

function syncTeacherAttendanceAfterEdit(teacherId, fullName) {
  if (!teacherAttendanceState) return;
  const teacher = teacherAttendanceState.teachers.find((item) => Number(item.teacherId) === Number(teacherId));
  if (!teacher) return;
  teacher.fullName = fullName;
  renderTeacherAttendance();
}

function syncTeacherAttendanceAfterDelete(teacherId) {
  if (!teacherAttendanceState) return;
  const beforeCount = teacherAttendanceState.teachers.length;
  teacherAttendanceState.teachers = teacherAttendanceState.teachers.filter((item) => Number(item.teacherId) !== Number(teacherId));
  if (teacherAttendanceState.teachers.length !== beforeCount) {
    renderTeacherAttendance();
  }
}

async function renderTeacherManagementList() {
  const tableEl = $('teacher-mgmt-table');
  if (!tableEl) return;
  showTableLoading('teacher-mgmt-table', 5, 'Đang tải giáo viên...');

  let teachers = [];
  try {
    teachers = await getListTeachers();
  } catch (err) {
    tableEl.innerHTML = '<tr><td colspan="5" class="text-muted text-center">Không tải được danh sách giáo viên</td></tr>';
    showToast(err?.message || 'Không tải được danh sách giáo viên', 'error');
    return;
  }

  teacherManagementRows = (teachers || []).map((teacher) => ({
    raw: teacher,
    teacherId: getTeacherIdValue(teacher),
    fullName: getTeacherNameValue(teacher),
    phoneNumber: getTeacherPhoneValue(teacher),
    classesDisplay: getTeacherClassDisplay(teacher),
  })).filter((teacher) => teacher.teacherId > 0);

  if (!teacherManagementRows.length) {
    tableEl.innerHTML = '<tr><td colspan="5" class="text-muted text-center">Chưa có giáo viên nào</td></tr>';
    return;
  }

  tableEl.innerHTML = teacherManagementRows.map((teacher) => {
    const phoneNumber = teacher.phoneNumber || '—';
    return `<tr><td>${teacher.teacherId}</td><td class="fw-600">${teacher.fullName || '—'}</td><td>${phoneNumber}</td><td>${teacher.classesDisplay}</td><td><button class="btn btn-outline btn-xs" onclick="openTeacherEditModal(${teacher.teacherId})">✏️</button> <button class="btn btn-danger btn-xs" onclick="deleteTeacherAlert(event, ${teacher.teacherId})">🗑</button></td></tr>`;
  }).join('');
}

async function loadTeacherAtt(event) {
  setButtonLoading(event, true, 'Đang tải...');
  const classId = Number($('tatt-class-select')?.value || 0);
  const month = $('tatt-month')?.value;
  if (!classId || !month) {
    setButtonLoading(event, false);
    return showToast('Chọn lớp và tháng!', 'error');
  }

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
      confirmedTotalCheckinDays: Number.isFinite(Number(teacher.totalCheckinDays)) ? Number(teacher.totalCheckinDays) : null,
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
  } finally {
    setButtonLoading(event, false);
  }
}

async function saveTeacherAtt(event) {
  setButtonLoading(event, true, 'Đang lưu...');
  if (!teacherAttendanceState) {
    setButtonLoading(event, false);
    showToast('Vui lòng tải danh sách điểm danh trước', 'error');
    return;
  }

  const payload = {
    month: teacherAttendanceState.month,
    teachers: teacherAttendanceState.teachers.map((teacher) => ({
      teacherId: Number(teacher.teacherId),
      classes: [{
        classId: Number(teacherAttendanceState.classId),
        checkedDates: Array.from(teacher.checkedDates).sort(),
      }],
    })),
  };

  try {
    const response = await updateTeacherCheckin(payload);

    const responseTeachers = Array.isArray(response?.teachers) ? response.teachers : [];
    const responseByTeacher = new Map(
      responseTeachers.map((teacher) => [Number(teacher?.teacherId), teacher])
    );

    teacherAttendanceState.teachers.forEach((teacher) => {
      const responseTeacher = responseByTeacher.get(Number(teacher.teacherId));
      const classes = Array.isArray(responseTeacher?.classes) ? responseTeacher.classes : [];
      const classEntry = classes.find((cls) => Number(cls?.classId) === Number(teacherAttendanceState.classId));
      if (classEntry && Number.isFinite(Number(classEntry.totalCheckinDays))) {
        teacher.confirmedTotalCheckinDays = Number(classEntry.totalCheckinDays);
      } else {
        teacher.confirmedTotalCheckinDays = null;
      }
    });

    refreshTeacherSummary();
    teacherAttendanceState.teachers.forEach((teacher) => {
      const checkedCountEl = $(`tatt-teacher-count-${teacher.teacherId}`);
      if (checkedCountEl) {
        checkedCountEl.textContent = `✓ Có dạy: ${getTeacherCheckedCount(teacher)} buổi`;
      }
    });

    showToast('Đã lưu điểm danh giáo viên!');
    await loadTeacherAtt();
  } catch (err) {
    showToast(err?.message || 'Không thể lưu điểm danh giáo viên', 'error');
  } finally {
    setButtonLoading(event, false);
  }
}

function openTeacherCreateModal() {
  if ($('tadd-name')) $('tadd-name').value = '';
  if ($('tadd-phone')) $('tadd-phone').value = '';
  openModal('modal-teacher-create');
}

function openTeacherEditModal(teacherId) {
  const row = teacherManagementRows.find((teacher) => Number(teacher.teacherId) === Number(teacherId));
  if (!row) {
    showToast('Không tìm thấy giáo viên', 'error');
    return;
  }

  $('edit-teacher-id').value = String(row.teacherId);
  $('tedit-name').value = row.fullName || '';
  $('tedit-phone').value = row.phoneNumber || '';
  openModal('modal-teacher-edit');
}

async function saveTeacherFromAttendance(event) {
  if (isCreatingTeacher) return;

  const fullName = $('tadd-name')?.value?.trim() || '';
  const phoneNumber = $('tadd-phone')?.value?.trim() || '';

  if (!fullName) {
    setButtonLoading(event, false);
    showToast('Vui lòng điền họ tên giáo viên!', 'error');
    return;
  }

  isCreatingTeacher = true;
  setButtonLoading(event, true, 'Đang lưu...');

  try {
    await createTeacher({
      fullName,
      phoneNumber: phoneNumber || undefined,
    });
    closeModal('modal-teacher-create');
    showToast('Đã thêm giáo viên mới!');
    await renderTeacherManagementList();
  } catch (err) {
    showToast(err?.message || 'Không thể thêm giáo viên', 'error');
  } finally {
    isCreatingTeacher = false;
    setButtonLoading(event, false);
  }
}

async function saveTeacherEdit(event) {
  if (isSavingTeacherEdit) return;

  const teacherId = Number($('edit-teacher-id')?.value || 0);
  const fullName = $('tedit-name')?.value?.trim() || '';
  const phoneNumber = $('tedit-phone')?.value?.trim() || '';

  if (!teacherId) {
    setButtonLoading(event, false);
    showToast('Không tìm thấy giáo viên', 'error');
    return;
  }

  if (!fullName) {
    setButtonLoading(event, false);
    showToast('Vui lòng điền họ tên giáo viên!', 'error');
    return;
  }

  isSavingTeacherEdit = true;
  setButtonLoading(event, true, 'Đang lưu...');
  try {
    await updateTeacher({
      id: teacherId,
      fullName,
      phoneNumber: phoneNumber || null,
      classIds: null,
    });
    closeModal('modal-teacher-edit');
    showToast('Đã cập nhật giáo viên!');
    syncTeacherAttendanceAfterEdit(teacherId, fullName);
    await renderTeacherManagementList();
  } catch (err) {
    showToast(err?.message || 'Không thể cập nhật giáo viên', 'error');
  } finally {
    isSavingTeacherEdit = false;
    setButtonLoading(event, false);
  }
}

async function deleteTeacherAlert(event, teacherId) {
  if (!confirm('Xóa giáo viên này?')) return;
  let forceDelete = false;
  if (confirm('Bấm OK để xóa tất cả (bao gồm cả dữ liệu liên quan). Cancel để xóa thường.')) {
    forceDelete = true;
  }

  setButtonLoading(event, true, 'Đang xóa...');

  try {
    await deleteTeacher(teacherId, forceDelete);
    showToast('Đã xóa giáo viên');
    syncTeacherAttendanceAfterDelete(teacherId);
    await renderTeacherManagementList();
  } catch (err) {
    showToast(err?.message || 'Không thể xóa giáo viên', 'error');
  } finally {
    setButtonLoading(event, false);
  }
}

Object.assign(window, {
  loadTeacherAtt,
  saveTeacherAtt,
  toggleTeacherAttDate: toggleTeacherDate,
  openTeacherCreateModal,
  saveTeacherFromAttendance,
  renderTeacherManagementList,
  openTeacherEditModal,
  saveTeacherEdit,
  deleteTeacherAlert,
});
export {
  loadTeacherAtt,
  saveTeacherAtt,
  openTeacherCreateModal,
  saveTeacherFromAttendance,
  renderTeacherManagementList,
  openTeacherEditModal,
  saveTeacherEdit,
  deleteTeacherAlert,
};