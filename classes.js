import { $, fmt, populateClassSelects, showToast, openModal, closeModal, getListClasses, getClassById, getListTeachers, getListStudents, createClass, updateClass } from './common.js';

function getClassIdValue(cls) {
  return Number(cls?.classId ?? cls?.id ?? cls?.class_id ?? 0);
}

function getTeacherIdValue(teacher) {
  return Number(teacher?.teacherId ?? teacher?.id ?? teacher?.teacher_id ?? 0);
}

function getTeacherNameValue(teacher) {
  return teacher?.teacherFullName ?? teacher?.fullName ?? teacher?.teacherName ?? teacher?.name ?? '—';
}

function getStudentIdValue(student) {
  return Number(student?.studentId ?? student?.id ?? student?.student_id ?? 0);
}

function getStudentNameValue(student) {
  return student?.fullName ?? student?.studentFullName ?? student?.studentName ?? student?.name ?? '—';
}

function getStudentClassIds(student) {
  const classIdsFromArray = Array.isArray(student?.classIds)
    ? student.classIds.map((classId) => Number(classId)).filter((classId) => classId > 0)
    : [];

  if (classIdsFromArray.length) return classIdsFromArray;

  if (Array.isArray(student?.classes)) {
    return student.classes
      .map((cls) => Number(cls?.classId ?? cls?.id ?? cls?.class_id ?? 0))
      .filter((classId) => classId > 0);
  }

  const classId = Number(student?.classId ?? student?.class_id ?? 0);
  return classId > 0 ? [classId] : [];
}

function getClassNameValue(cls) {
  return cls?.className ?? cls?.name ?? '';
}

function getClassRateValue(cls) {
  return Number(cls?.feePerDay ?? cls?.rate ?? 0);
}

function getClassScheduleValue(cls) {
  return cls?.timeTable ?? cls?.schedule ?? null;
}

function getClassTeacherIds(cls) {
  const teacherIdsFromArray = Array.isArray(cls?.teachers)
    ? cls.teachers.map((teacher) => getTeacherIdValue(teacher)).filter((teacherId) => teacherId > 0)
    : [];
  if (teacherIdsFromArray.length) return teacherIdsFromArray;

  return Array.isArray(cls?.teacherIds)
    ? cls.teacherIds.map((teacherId) => Number(teacherId)).filter((teacherId) => teacherId > 0)
    : [];
}

function getClassStudentIds(cls) {
  const studentIdsFromArray = Array.isArray(cls?.students)
    ? cls.students.map((student) => getStudentIdValue(student)).filter((studentId) => studentId > 0)
    : [];
  if (studentIdsFromArray.length) return studentIdsFromArray;

  return Array.isArray(cls?.studentIds)
    ? cls.studentIds.map((studentId) => Number(studentId)).filter((studentId) => studentId > 0)
    : [];
}

function getClassTeacherDisplay(cls) {
  if (Array.isArray(cls?.teachers) && cls.teachers.length) {
    return cls.teachers
      .map((teacher) => getTeacherNameValue(teacher))
      .filter(Boolean)
      .join(', ');
  }

  if (typeof cls?.teacherFullName === 'string' && cls.teacherFullName.trim()) {
    return cls.teacherFullName;
  }

  if (typeof cls?.teacher === 'string' && cls.teacher.trim()) {
    return cls.teacher;
  }

  return '—';
}

async function populateClassTeacherMultiSelect(selectedTeacherIds = []) {
  const selectEl = $('c-teachers');
  if (!selectEl) return;

  const selectedSet = new Set((selectedTeacherIds || []).map((id) => String(id)));
  const teachers = await getListTeachers();
  selectEl.innerHTML = '';

  teachers.forEach((teacher) => {
    const teacherId = getTeacherIdValue(teacher);
    if (!teacherId) return;
    const teacherName = getTeacherNameValue(teacher);
    selectEl.add(new Option(teacherName, String(teacherId), false, selectedSet.has(String(teacherId))));
  });
}

async function populateClassStudentAssignmentSelect(selectedStudentIds = []) {
  const selectEl = $('ca-students');
  if (!selectEl) return;

  const selectedSet = new Set((selectedStudentIds || []).map((id) => String(id)));
  const students = await getListStudents();
  selectEl.innerHTML = '';

  students.forEach((student) => {
    const studentId = getStudentIdValue(student);
    if (!studentId) return;
    const studentName = getStudentNameValue(student);
    selectEl.add(new Option(studentName, String(studentId), false, selectedSet.has(String(studentId))));
  });
}

function updateClassStudentSelectionCount() {
  const selectedCount = Array.from($('ca-students')?.selectedOptions || []).length;
  const countEl = $('ca-selected-count');
  if (!countEl) return;
  countEl.textContent = `Đã chọn ${selectedCount} học sinh`;
}

async function getFallbackStudentIdsByClassId(classId) {
  const students = await getListStudents();
  return students
    .filter((student) => getStudentClassIds(student).includes(Number(classId)))
    .map((student) => getStudentIdValue(student))
    .filter((studentId) => studentId > 0);
}

async function findClassForEdit(id) {
  try {
    const res = await getClassById(id);
    return res?.class || res;
  } catch (err) {
    const classes = await getListClasses();
    return classes.find((cls) => getClassIdValue(cls) === Number(id));
  }
}

async function renderClasses() {
  const classes = await getListClasses();

  if (classes && classes.length) {
    $('class-table').innerHTML = classes.map((c) => {
      const classId = getClassIdValue(c);
      const teachersDisplay = getClassTeacherDisplay(c);
      return `<tr><td class="fw-600">${c.className || '—'}</td><td>${teachersDisplay}</td><td>${fmt(c.feePerDay)}</td><td>${c.timeTable || '—'}</td><td>${c.totalStudents || 0} HV</td><td><button class="btn btn-outline btn-xs" onclick="openClassModal(${classId})">✏️</button> <button class="btn btn-outline btn-xs" onclick="openClassStudentAssignModal(${classId})">👥</button> <button class="btn btn-danger btn-xs" onclick="deleteClassAlert(${classId})">🗑</button></td></tr>`;
    }).join('');
    return;
  }

  $('class-table').innerHTML = '<tr><td colspan="6" class="text-muted text-center">Chưa có lớp học nào</td></tr>';
}

async function openClassModal(id) {
  $('edit-class-id').value = id || '';
  $('modal-class-title').textContent = id ? 'Sửa lớp học' : 'Thêm lớp học mới';

  try {
    if (id) {
      const cls = await findClassForEdit(id);
      if (!cls) {
        showToast('Không tìm thấy lớp học', 'error');
        return;
      }

      $('c-name').value = cls.className ?? cls.name ?? '';
      $('c-rate').value = cls.feePerDay ?? cls.rate ?? '';
      $('c-schedule').value = cls.timeTable ?? cls.schedule ?? '';

      await populateClassTeacherMultiSelect(getClassTeacherIds(cls));
    } else {
      ['c-name', 'c-rate', 'c-schedule'].forEach((f) => ($(f).value = ''));
      await populateClassTeacherMultiSelect([]);
    }
  } catch (err) {
    showToast(err?.message || 'Không thể tải dữ liệu lớp/giáo viên', 'error');
    return;
  }

  openModal('modal-class');
}

async function saveClass() {
  const name = $('c-name').value.trim();
  const rate = +$('c-rate').value;
  const schedule = $('c-schedule').value.trim();
  const teacherIds = Array.from($('c-teachers')?.selectedOptions || [])
    .map((option) => Number(option.value))
    .filter((teacherId) => teacherId > 0);

  if (!name || !rate || teacherIds.length === 0) {
    return showToast('Vui lòng điền đầy đủ thông tin!', 'error');
  }

  const id = +$('edit-class-id').value;

  try {
    if (id) {
      await updateClass({
        id,
        className: name,
        feePerDay: rate,
        timeTable: schedule || null,
        teacherIds: teacherIds.length ? teacherIds : null,
      });
      showToast('Đã cập nhật lớp học!');
    } else {
      await createClass({
        className: name,
        feePerDay: rate,
        timeTable: schedule || null,
        teacherIds: teacherIds.length ? teacherIds : null,
      });
      showToast('Đã thêm lớp mới!');
    }
  } catch (err) {
    showToast(err?.message || 'Lỗi lưu lớp học', 'error');
    return;
  }

  closeModal('modal-class');
  renderClasses();
  populateClassSelects();
}

async function openClassStudentAssignModal(id) {
  const classId = Number(id);
  if (!classId) {
    showToast('Không tìm thấy lớp học', 'error');
    return;
  }

  $('edit-class-student-id').value = String(classId);

  try {
    const cls = await findClassForEdit(classId);
    if (!cls) {
      showToast('Không tìm thấy lớp học', 'error');
      return;
    }

    const classLabel = getClassNameValue(cls) || `Lớp #${classId}`;
    $('modal-class-student-title').textContent = `Quản lý học sinh - ${classLabel}`;

    let selectedStudentIds = getClassStudentIds(cls);
    if (!selectedStudentIds.length) {
      selectedStudentIds = await getFallbackStudentIdsByClassId(classId);
    }

    await populateClassStudentAssignmentSelect(selectedStudentIds);
    updateClassStudentSelectionCount();
    openModal('modal-class-assign-students');
  } catch (err) {
    showToast(err?.message || 'Không thể tải danh sách học sinh', 'error');
  }
}

async function saveClassStudentAssignment() {
  const classId = Number($('edit-class-student-id')?.value || 0);
  if (!classId) {
    showToast('Không tìm thấy lớp học', 'error');
    return;
  }

  const studentIds = Array.from($('ca-students')?.selectedOptions || [])
    .map((option) => Number(option.value))
    .filter((studentId) => studentId > 0);

  try {
    const cls = await findClassForEdit(classId);
    if (!cls) {
      showToast('Không tìm thấy lớp học', 'error');
      return;
    }

    const teacherIds = getClassTeacherIds(cls);

    await updateClass({
      id: classId,
      className: getClassNameValue(cls),
      feePerDay: getClassRateValue(cls),
      timeTable: getClassScheduleValue(cls),
      teacherIds: teacherIds.length ? teacherIds : null,
      studentIds: studentIds.length ? studentIds : null,
    });

    closeModal('modal-class-assign-students');
    showToast('Đã cập nhật học sinh trong lớp!');
    renderClasses();
    populateClassSelects();
  } catch (err) {
    showToast(err?.message || 'Lỗi cập nhật học sinh trong lớp', 'error');
  }
}

async function deleteClassAlert(id) {
  if (!confirm('Xóa lớp này?')) return;
  try {
    await deleteClass(id);
    showToast('Đã xóa lớp');
  } catch (err) {
    showToast(err?.message || 'Lỗi xoá lớp', 'error');
    return;
  }
  renderClasses();
  populateClassSelects();
}

Object.assign(window, { renderClasses, openClassModal, saveClass, deleteClassAlert, openClassStudentAssignModal, saveClassStudentAssignment, updateClassStudentSelectionCount });
export { renderClasses, openClassModal, saveClass, deleteClassAlert, openClassStudentAssignModal, saveClassStudentAssignment, updateClassStudentSelectionCount };