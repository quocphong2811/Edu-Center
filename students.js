import { $, fmt, getClassName, getStudentById, populateClassSelects, showToast, openModal, closeModal, thisMonth, createStudent, getStudentsByClass, getListStudents, getStudentsByKeyword, updateStudent, deleteStudent, getListClasses } from './common.js';

function getClassIdValue(cls) {
  const classId = cls?.id ?? cls?.classId ?? cls?.class_id;
  if (classId == null || classId === '') return null;
  return String(classId);
}

function getStudentClassDisplay(classes) {
  if (!classes || !classes.length) return '—';
  for (const cls of classes) {
    if (typeof cls?.className === 'string' && cls.className.trim()) {
      return cls.className;
    }
    return cls?.className?.join(', ') || '—';
  }
}

async function populateStudentClassMultiSelect(selectedClassIds = []) {
  const selectEl = $('s-classes');
  if (!selectEl) return;

  const selectedSet = new Set((selectedClassIds || []).map((id) => String(id)));
  const classes = await getListClasses();
  selectEl.innerHTML = '';

  classes.forEach((cls) => {
    const classId = getClassIdValue(cls);
    if (!classId) return;
    const option = new Option(cls.className, classId, false, selectedSet.has(classId));
    selectEl.add(option);
  });
}

async function renderStudents(existingStudents) {
  const students = existingStudents || await getListStudents();

  $('student-table').innerHTML = students.map((s, i) => {
    const classDisplay = getStudentClassDisplay(s.classes);
    return `<tr><td>${s.studentId}</td><td class="fw-600">${s.fullName || '—'}</td><td>${classDisplay}</td><td>${s.personalPhone || '—'}</td><td>${s.parentPhone || '—'}</td><td><span class="badge badge-gray">Chưa có HP</span></td><td><button class="btn btn-outline btn-xs" onclick="openStudentModal(${s.studentId})">✏️</button> <button class="btn btn-danger btn-xs" onclick="deleteStudentAlert(${s.studentId})">🗑</button></td></tr>`;
  }).join('') || '<tr><td colspan="7" class="text-muted text-center">Chưa có học viên nào</td></tr>';
}
  
async function filterStudentsByClass() {
  const classId = $('student-filter-class').value;

  let students = [];
  if (classId) {
    students = await getStudentsByClass(Number(classId));
  } else {
    students = await getListStudents();
  }
  renderStudents(students);
}

async function filterStudentsByKeyword() {
  const keyword = $('student-search').value.trim();

  let students = [];
  if (keyword) {
    students = await getStudentsByKeyword(keyword);
  } else {
    students = await getListStudents();
  }
  renderStudents(students);
}

async function openStudentModal(id) {
  $('edit-student-id').value = id || '';
  $('modal-student-title').textContent = id ? 'Sửa thông tin học viên' : 'Thêm học viên mới';
  if (id) {
    const savedStudent = await getStudentById(id);
    const student = savedStudent?.student;
    const classes = savedStudent?.classes || [];
    $('s-name').value = student?.fullName || '';
    $('s-phone').value = student?.personalPhone || '';
    $('s-parent-phone').value = student?.parentPhone || '';

    const classIdsFromClasses = classes
      .map((cls) => getClassIdValue(cls))
      .filter(Boolean);
    const classIdsFromStudent = Array.isArray(student?.classIds)
      ? student.classIds.map((classId) => String(classId))
      : [];
    const selectedClassIds = classIdsFromClasses.length ? classIdsFromClasses : classIdsFromStudent;
    await populateStudentClassMultiSelect(selectedClassIds);
  } else {
    ['s-name', 's-phone', 's-parent-phone'].forEach((f) => ($(f).value = ''));
    await populateStudentClassMultiSelect([]);
  }
  openModal('modal-student');
}

async function saveStudent() {
  const name = $('s-name').value.trim();
  const personalPhone = $('s-phone').value.trim();
  const parentPhone = $('s-parent-phone').value.trim();
  const selectedClassIds = Array.from($('s-classes')?.selectedOptions || [])
    .map((opt) => opt.value)
    .filter(Boolean);
  const createClassIds = selectedClassIds.length ? selectedClassIds : null;
  const updateClassIds = selectedClassIds.length
    ? selectedClassIds.map((classId) => Number(classId)).filter((classId) => !Number.isNaN(classId))
    : null;

  if (!name || !personalPhone) return showToast('Vui lòng điền đầy đủ thông tin!', 'error');
  const id = +$('edit-student-id').value;
  if (id) {
    const s = await getStudentById(id);
    await updateStudent({
      ...s.student,
      id: id,
      fullName: name,
      personalPhone,
      parentPhone: parentPhone || null,
      classIds: updateClassIds
    });
    showToast('Đã cập nhật học viên!');
  } else {
    try {
      await createStudent({
        fullName: name,
        personalPhone,
        parentPhone: parentPhone || null,
        classIds: createClassIds,
      });
      showToast('Đã thêm học viên mới!');
    } catch (err) {
      showToast(err?.message || 'Lỗi tạo học viên', 'error');
      return;
    }
  }
  closeModal('modal-student');
  renderStudents();
  populateClassSelects();
}

async function deleteStudentAlert(id) {
  if (!confirm('Xóa học viên này?')) return;
  let forceDelete = false;
  if (confirm('Bấm OK để xoá luôn cả hoá đơn học phí của học viên này. Cancel để chỉ xoá học viên mà không xoá hoá đơn.')) { 
    forceDelete = true;
  }
  try {
    await deleteStudent(id, forceDelete);
    showToast('Đã xóa học viên');
  } catch (err) {
    showToast(err?.message || 'Lỗi xoá học viên', 'error');
    return;
  }
  renderStudents();
}

Object.assign(window, { renderStudents, filterStudentsByClass, filterStudentsByKeyword, openStudentModal, saveStudent, deleteStudentAlert });
export { renderStudents, filterStudentsByClass, filterStudentsByKeyword, openStudentModal, saveStudent, deleteStudentAlert };