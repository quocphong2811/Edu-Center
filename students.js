import { $, fmt, getClassName, getStudentById, populateClassSelects, showToast, openModal, closeModal, thisMonth, createStudent, getStudentsByClass, getListStudents, getStudentsByKeyword, updateStudent, deleteStudent, getListClasses } from './common.js';

let renderedStudentsCache = [];
let activeStudentClassTooltipId = null;
const studentClassNamesById = new Map();
let hasStudentTooltipOutsideClickListener = false;

function getClassIdValue(cls) {
  const classId = cls?.id ?? cls?.classId ?? cls?.class_id;
  if (classId == null || classId === '') return null;
  return String(classId);
}

function getStudentClassDisplay(classes) {
  const classNames = Array.isArray(classes)
    ? classes
      .map((cls) => cls?.className)
      .filter((className) => typeof className === 'string' && className.trim())
      .map((className) => className.trim())
    : [];

  if (!classNames.length) return '—';
  if (classNames.length === 1) return classNames[0];
  return 'Nhiều lớp';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getClassNames(classes) {
  if (!Array.isArray(classes)) return [];

  return classes
    .map((cls) => cls?.className)
    .filter((className) => typeof className === 'string' && className.trim())
    .map((className) => className.trim());
}

function ensureTooltipOutsideClickListener() {
  if (hasStudentTooltipOutsideClickListener) return;

  document.addEventListener('click', (event) => {
    if (activeStudentClassTooltipId == null) return;
    const target = event.target;
    if (target instanceof Element && target.closest('.student-class-tooltip-wrap')) return;

    activeStudentClassTooltipId = null;
    renderStudents(renderedStudentsCache);
  });

  hasStudentTooltipOutsideClickListener = true;
}

function renderStudentClassCell(student) {
  const studentId = Number(student?.studentId || 0);
  const classNames = getClassNames(student?.classes);
  studentClassNamesById.set(studentId, classNames);

  if (!classNames.length) return '—';
  if (classNames.length === 1) return escapeHtml(classNames[0]);

  const tooltipItems = classNames
    .map((className) => `<li>${escapeHtml(className)}</li>`)
    .join('');
  const isOpen = activeStudentClassTooltipId === studentId ? ' open' : '';

  return `
    <div class="student-class-tooltip-wrap">
      <button type="button" class="student-class-trigger" onclick="toggleStudentClassTooltip(${studentId}, event)">Nhiều lớp</button>
      <div class="student-class-tooltip${isOpen}">
        <ul>${tooltipItems}</ul>
      </div>
    </div>
  `;
}

function toggleStudentClassTooltip(studentId, event) {
  event?.stopPropagation?.();
  const id = Number(studentId || 0);
  const classNames = studentClassNamesById.get(id) || [];
  if (classNames.length <= 1) return;

  activeStudentClassTooltipId = activeStudentClassTooltipId === id ? null : id;
  renderStudents(renderedStudentsCache);
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
  ensureTooltipOutsideClickListener();
  const students = existingStudents || await getListStudents();
  renderedStudentsCache = Array.isArray(students) ? students : [];

  const hasActiveStudent = renderedStudentsCache.some((student) => Number(student?.studentId || 0) === Number(activeStudentClassTooltipId));
  if (!hasActiveStudent) activeStudentClassTooltipId = null;

  $('student-table').innerHTML = renderedStudentsCache.map((s) => {
    const classCell = renderStudentClassCell(s);
    return `<tr><td>${s.studentId}</td><td class="fw-600">${s.fullName || '—'}</td><td>${classCell}</td><td>${s.personalPhone || '—'}</td><td>${s.parentPhone || '—'}</td><td><span class="badge badge-gray">Chưa có HP</span></td><td><button class="btn btn-outline btn-xs" onclick="openStudentModal(${s.studentId})">✏️</button> <button class="btn btn-danger btn-xs" onclick="deleteStudentAlert(${s.studentId})">🗑</button></td></tr>`;
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
    const student = savedStudent?.student || savedStudent || {};
    const classes = savedStudent?.classes || student?.classes || [];
    $('s-name').value = student?.fullName || '';
    $('s-phone').value = student?.personalPhone || '';
    $('s-parent-phone').value = student?.parentPhone || '';

    const classIdsFromClasses = classes
      .map((cls) => getClassIdValue(cls))
      .filter(Boolean);
    const classIdsFromStudent = Array.isArray(student?.classIds)
      ? student.classIds.map((classId) => String(classId))
      : [];
    const classIdsFromStudentClasses = Array.isArray(student?.classes)
      ? student.classes
        .map((cls) => getClassIdValue(cls))
        .filter(Boolean)
      : [];
    const selectedClassIds = classIdsFromClasses.length ? classIdsFromClasses : classIdsFromStudent;
    const normalizedSelectedClassIds = selectedClassIds.length ? selectedClassIds : classIdsFromStudentClasses;
    await populateStudentClassMultiSelect(normalizedSelectedClassIds);
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
    await updateStudent({
      id: id,
      fullName: name,
      personalPhone,
      parentPhone: parentPhone || null,
      classIds: updateClassIds,
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

Object.assign(window, { renderStudents, filterStudentsByClass, filterStudentsByKeyword, openStudentModal, saveStudent, deleteStudentAlert, toggleStudentClassTooltip });
export { renderStudents, filterStudentsByClass, filterStudentsByKeyword, openStudentModal, saveStudent, deleteStudentAlert, toggleStudentClassTooltip };