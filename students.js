import { $, fmt, getClassName, getStudentById, populateClassSelects, showToast, openModal, closeModal, thisMonth, createStudent, getStudentsByClass, getStudentsByKeyword, updateStudent, deleteStudent, getListClasses, setButtonLoading, showTableLoading, setModalLoading } from './common.js';

let renderedStudentsCache = [];
let activeStudentClassTooltipId = null;
const studentClassNamesById = new Map();
let hasStudentTooltipOutsideClickListener = false;

const DEFAULT_STUDENT_EMPTY_MESSAGE = 'Chọn lớp để xem học viên';
const NO_CLASS_STUDENT_EMPTY_MESSAGE = 'Chưa có lớp nào để hiển thị học viên';
const NO_STUDENTS_IN_CLASS_MESSAGE = 'Lớp này chưa có học viên';
const NO_STUDENT_SEARCH_RESULTS_MESSAGE = 'Không tìm thấy học viên phù hợp';

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

function studentBelongsToClass(student, classId) {
  const targetClassId = String(classId || '').trim();
  if (!targetClassId) return false;

  if (Array.isArray(student?.classIds)) {
    return student.classIds.some((value) => String(value) === targetClassId);
  }

  if (Array.isArray(student?.classes)) {
    return student.classes.some((cls) => getClassIdValue(cls) === targetClassId);
  }

  return String(student?.classId ?? student?.class_id ?? '') === targetClassId;
}

function studentMatchesKeyword(student, keyword) {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase();
  if (!normalizedKeyword) return true;

  const searchableValues = [
    student?.fullName,
    student?.personalPhone,
    student?.parentPhone,
    ...getClassNames(student?.classes),
  ];

  return searchableValues.some((value) => String(value || '').toLowerCase().includes(normalizedKeyword));
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

function getStudentTableEmptyState(message = DEFAULT_STUDENT_EMPTY_MESSAGE) {
  return `<tr><td colspan="7" class="text-muted text-center">${escapeHtml(message)}</td></tr>`;
}

async function syncStudentFilterSelection({ preferredClassId = null, autoSelectFirstClass = true } = {}) {
  const filterEl = $('student-filter-class');
  if (!filterEl) return { classId: null, hasClasses: false };

  const classes = await getListClasses();
  const classIds = classes
    .map((cls) => getClassIdValue(cls))
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

async function renderStudents(existingStudents = [], emptyMessage = DEFAULT_STUDENT_EMPTY_MESSAGE) {
  ensureTooltipOutsideClickListener();
  renderedStudentsCache = Array.isArray(existingStudents) ? existingStudents : [];

  const hasActiveStudent = renderedStudentsCache.some((student) => Number(student?.studentId || 0) === Number(activeStudentClassTooltipId));
  if (!hasActiveStudent) activeStudentClassTooltipId = null;

  $('student-table').innerHTML = renderedStudentsCache.map((s) => {
    const classCell = renderStudentClassCell(s);
    const badgeFeeStatus =
    s.feeStatus === 'paid'
      ? '<span class="badge badge-green">Đã nộp đủ</span>'
      : s.feeStatus === 'partial'
        ? '<span class="badge badge-yellow">Nộp một phần</span>'
        : s.feeStatus === 'unpaid'
          ? '<span class="badge badge-red">Chưa nộp</span>'
          : '<span class="badge badge-gray">Chưa có HP</span>';
    return `<tr><td>${s.studentId}</td><td class="fw-600">${s.fullName || '—'}</td><td>${classCell}</td><td>${s.personalPhone || '—'}</td><td>${s.parentPhone || '—'}</td><td>${badgeFeeStatus}</td><td><button class="btn btn-outline btn-xs" onclick="openStudentModal(${s.studentId})">✏️</button> <button class="btn btn-danger btn-xs" onclick="deleteStudentAlert(event, ${s.studentId})">🗑</button></td></tr>`;
  }).join('') || getStudentTableEmptyState(emptyMessage);
}

async function loadStudentsForSelectedClass({ preferredClassId = null, autoSelectFirstClass = true } = {}) {
  showTableLoading('student-table', 7, 'Đang tải học viên...');
  const { classId, hasClasses } = await syncStudentFilterSelection({ preferredClassId, autoSelectFirstClass });
  const keyword = $('student-search')?.value.trim() || '';

  if (!classId) {
    const emptyMessage = hasClasses ? DEFAULT_STUDENT_EMPTY_MESSAGE : NO_CLASS_STUDENT_EMPTY_MESSAGE;
    await renderStudents([], emptyMessage);
    return;
  }

  if (keyword) {
    await filterStudentsByKeyword();
    return;
  }

  const students = await getStudentsByClass(Number(classId));
  await renderStudents(students, NO_STUDENTS_IN_CLASS_MESSAGE);
}

async function initializeStudentsPage() {
  await loadStudentsForSelectedClass();
}
  
async function filterStudentsByClass() {
  showTableLoading('student-table', 7, 'Đang tải học viên...');
  const classId = $('student-filter-class')?.value;
  const keyword = $('student-search')?.value.trim() || '';

  if (!classId) {
    await renderStudents([], DEFAULT_STUDENT_EMPTY_MESSAGE);
    return;
  }

  if (keyword) {
    await filterStudentsByKeyword();
    return;
  }

  const students = await getStudentsByClass(Number(classId));
  await renderStudents(students, NO_STUDENTS_IN_CLASS_MESSAGE);
}

async function filterStudentsByKeyword() {
  showTableLoading('student-table', 7, 'Đang tải học viên...');
  const keyword = $('student-search').value.trim();
  const classId = $('student-filter-class')?.value;

  if (!classId) {
    if (!keyword) {
      await renderStudents([], DEFAULT_STUDENT_EMPTY_MESSAGE);
      return;
    }

    const students = await getStudentsByKeyword(keyword);
    await renderStudents(students, NO_STUDENT_SEARCH_RESULTS_MESSAGE);
    return;
  }

  const studentsInClass = await getStudentsByClass(Number(classId));
  if (!keyword) {
    await renderStudents(studentsInClass, NO_STUDENTS_IN_CLASS_MESSAGE);
    return;
  }

  const classScopedStudents = studentsInClass
    .filter((student) => studentBelongsToClass(student, classId))
    .filter((student) => studentMatchesKeyword(student, keyword));
  await renderStudents(classScopedStudents, NO_STUDENT_SEARCH_RESULTS_MESSAGE);
}

async function openStudentModal(id) {
  $('edit-student-id').value = id || '';
  $('modal-student-title').textContent = id ? 'Sửa thông tin học viên' : 'Thêm học viên mới';
  openModal('modal-student');
  setModalLoading('modal-student', true, 'Đang tải dữ liệu học viên...');

  try {
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
  } catch (err) {
    showToast(err?.message || 'Không thể tải dữ liệu học viên', 'error');
  } finally {
    setModalLoading('modal-student', false);
  }
}

async function saveStudent(event) {
  setButtonLoading(event, true, 'Đang lưu...');
  try {
    const name = $('s-name').value.trim();
    const personalPhone = $('s-phone').value.trim();
    const parentPhone = $('s-parent-phone').value.trim();
    const currentFilterClassId = String($('student-filter-class')?.value || '').trim();
    const selectedClassIds = Array.from($('s-classes')?.selectedOptions || [])
      .map((opt) => opt.value)
      .filter(Boolean);
    const createClassIds = selectedClassIds.length ? selectedClassIds : null;
    const updateClassIds = selectedClassIds.length
      ? selectedClassIds.map((classId) => Number(classId)).filter((classId) => !Number.isNaN(classId))
      : null;

    if (!name || !personalPhone) {
      showToast('Vui lòng điền đầy đủ thông tin!', 'error');
      return;
    }

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

    const preferredClassId = currentFilterClassId || selectedClassIds[0] || null;
    const shouldAutoSelectFirstClass = Boolean(currentFilterClassId || selectedClassIds[0]);

    closeModal('modal-student');
    await populateClassSelects();
    await loadStudentsForSelectedClass({
      preferredClassId,
      autoSelectFirstClass: shouldAutoSelectFirstClass,
    });
  } catch (err) {
    showToast(err?.message || 'Không thể lưu học viên', 'error');
  } finally {
    setButtonLoading(event, false);
  }
}

async function deleteStudentAlert(event, id) {
  if (!confirm('Xóa học viên này?')) return;
  setButtonLoading(event, true, 'Đang xóa...');
  let forceDelete = false;
  let deleted = false;
  if (confirm('Bấm OK để xoá luôn cả hoá đơn học phí của học viên này. Cancel để chỉ xoá học viên mà không xoá hoá đơn.')) { 
    forceDelete = true;
  }
  try {
    await deleteStudent(id, forceDelete);
    showToast('Đã xóa học viên');
    deleted = true;
  } catch (err) {
    showToast(err?.message || 'Lỗi xoá học viên', 'error');
  } finally {
    setButtonLoading(event, false);
  }

  if (!deleted) return;

  await loadStudentsForSelectedClass({
    preferredClassId: String($('student-filter-class')?.value || '').trim() || null,
    autoSelectFirstClass: true,
  });
}

Object.assign(window, { initializeStudentsPage, renderStudents, filterStudentsByClass, filterStudentsByKeyword, openStudentModal, saveStudent, deleteStudentAlert, toggleStudentClassTooltip });
export { initializeStudentsPage, renderStudents, filterStudentsByClass, filterStudentsByKeyword, openStudentModal, saveStudent, deleteStudentAlert, toggleStudentClassTooltip };