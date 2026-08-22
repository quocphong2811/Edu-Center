import { $, fmt, populateClassSelects, showToast, openModal, closeModal, getListClasses, getClassById, getListTeachers, getListStudents, createClass, updateClass, setButtonLoading, showTableLoading, setModalLoading } from './common.js';

let renderedClassesCache = [];
let activeClassTeacherTooltipId = null;
const classTeacherNamesByClassId = new Map();
let hasClassTeacherTooltipOutsideClickListener = false;
const CLASS_STUDENT_PAGE_SIZE = 50;
const CLASS_STUDENT_SCROLL_PREFETCH_PX = 48;
const classStudentSelectState = {
  isLoading: false,
  hasMore: true,
  offset: 0,
  version: 0,
  selectedIds: new Set(),
  loadedIds: new Set(),
};
let hasClassStudentSelectScrollListener = false;

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

function normalizeStudentListPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.students)) return payload.students;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function shouldLoadMoreOnScroll(el, threshold = CLASS_STUDENT_SCROLL_PREFETCH_PX) {
  if (!el) return false;
  return el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
}

function hasMissingSelectedStudents() {
  for (const studentId of classStudentSelectState.selectedIds) {
    if (!classStudentSelectState.loadedIds.has(studentId)) return true;
  }
  return false;
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

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getClassTeacherNames(cls) {
  if (Array.isArray(cls?.teachers) && cls.teachers.length) {
    const names = cls.teachers
      .map((teacher) => getTeacherNameValue(teacher))
      .filter((name) => typeof name === 'string' && name.trim())
      .map((name) => name.trim());
    if (names.length) return names;
  }

  if (typeof cls?.teacherFullName === 'string' && cls.teacherFullName.trim()) {
    return cls.teacherFullName
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }

  if (typeof cls?.teacher === 'string' && cls.teacher.trim()) {
    return cls.teacher
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }

  return [];
}

function ensureClassTeacherTooltipOutsideClickListener() {
  if (hasClassTeacherTooltipOutsideClickListener) return;

  document.addEventListener('click', (event) => {
    if (activeClassTeacherTooltipId == null) return;
    const target = event.target;
    if (target instanceof Element && target.closest('.class-teacher-tooltip-wrap')) return;

    activeClassTeacherTooltipId = null;
    renderClasses(renderedClassesCache);
  });

  hasClassTeacherTooltipOutsideClickListener = true;
}

function renderClassTeacherCell(cls) {
  const classId = getClassIdValue(cls);
  const teacherNames = getClassTeacherNames(cls);
  classTeacherNamesByClassId.set(classId, teacherNames);

  if (!teacherNames.length) return '—';
  if (teacherNames.length === 1) return escapeHtml(teacherNames[0]);

  const tooltipItems = teacherNames
    .map((teacherName) => `<li>${escapeHtml(teacherName)}</li>`)
    .join('');
  const isOpen = activeClassTeacherTooltipId === classId ? ' open' : '';

  return `
    <div class="class-teacher-tooltip-wrap">
      <button type="button" class="class-teacher-trigger" onclick="toggleClassTeacherTooltip(${classId}, event)">Nhiều giáo viên</button>
      <div class="class-teacher-tooltip${isOpen}">
        <ul>${tooltipItems}</ul>
      </div>
    </div>
  `;
}

function toggleClassTeacherTooltip(classId, event) {
  event?.stopPropagation?.();
  const id = Number(classId || 0);
  const teacherNames = classTeacherNamesByClassId.get(id) || [];
  if (teacherNames.length <= 1) return;

  activeClassTeacherTooltipId = activeClassTeacherTooltipId === id ? null : id;
  renderClasses(renderedClassesCache);
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

  if (!hasClassStudentSelectScrollListener) {
    selectEl.addEventListener('scroll', async () => {
      if (!shouldLoadMoreOnScroll(selectEl)) return;
      await loadMoreClassStudentAssignmentOptions(selectEl);
    });
    hasClassStudentSelectScrollListener = true;
  }

  classStudentSelectState.version += 1;
  classStudentSelectState.isLoading = false;
  classStudentSelectState.hasMore = true;
  classStudentSelectState.offset = 0;
  classStudentSelectState.selectedIds = new Set((selectedStudentIds || []).map((id) => Number(id)).filter((id) => id > 0));
  classStudentSelectState.loadedIds = new Set();

  selectEl.innerHTML = '';

  await loadMoreClassStudentAssignmentOptions(selectEl);

  while (classStudentSelectState.hasMore && hasMissingSelectedStudents()) {
    await loadMoreClassStudentAssignmentOptions(selectEl);
  }
}

async function loadMoreClassStudentAssignmentOptions(selectEl) {
  if (!selectEl || classStudentSelectState.isLoading || !classStudentSelectState.hasMore) return;

  const requestVersion = classStudentSelectState.version;
  classStudentSelectState.isLoading = true;
  try {
    const payload = await getListStudents({
      limit: CLASS_STUDENT_PAGE_SIZE,
      offset: classStudentSelectState.offset,
    });

    if (requestVersion !== classStudentSelectState.version) return;

    const students = normalizeStudentListPayload(payload);

    students.forEach((student) => {
      const studentId = getStudentIdValue(student);
      if (!studentId || classStudentSelectState.loadedIds.has(studentId)) return;
      classStudentSelectState.loadedIds.add(studentId);

      const studentName = getStudentNameValue(student);
      const isSelected = classStudentSelectState.selectedIds.has(studentId);
      selectEl.add(new Option(studentName, String(studentId), false, isSelected));
    });

    classStudentSelectState.offset += students.length;
    classStudentSelectState.hasMore = students.length === CLASS_STUDENT_PAGE_SIZE;
    updateClassStudentSelectionCount();
  } finally {
    if (requestVersion === classStudentSelectState.version) {
      classStudentSelectState.isLoading = false;
    }
  }
}

function updateClassStudentSelectionCount() {
  const selectedCount = Array.from($('ca-students')?.selectedOptions || []).length;
  const countEl = $('ca-selected-count');
  if (!countEl) return;
  countEl.textContent = `Đã chọn ${selectedCount} học sinh`;
}

async function getFallbackStudentIdsByClassId(classId) {
  const targetClassId = Number(classId);
  let offset = 0;
  const foundStudentIds = [];

  while (true) {
    const payload = await getListStudents({
      limit: CLASS_STUDENT_PAGE_SIZE,
      offset,
    });
    const students = normalizeStudentListPayload(payload);
    if (!students.length) break;

    students.forEach((student) => {
      if (!getStudentClassIds(student).includes(targetClassId)) return;
      const studentId = getStudentIdValue(student);
      if (studentId > 0) foundStudentIds.push(studentId);
    });

    if (students.length < CLASS_STUDENT_PAGE_SIZE) break;
    offset += students.length;
  }

  return foundStudentIds;
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

async function renderClasses(existingClasses) {
  ensureClassTeacherTooltipOutsideClickListener();
  if (!existingClasses) showTableLoading('class-table', 6, 'Đang tải lớp học...');
  const classes = existingClasses || await getListClasses();
  renderedClassesCache = Array.isArray(classes) ? classes : [];

  const hasActiveClass = renderedClassesCache.some((cls) => getClassIdValue(cls) === Number(activeClassTeacherTooltipId));
  if (!hasActiveClass) activeClassTeacherTooltipId = null;

  if (renderedClassesCache.length) {
    $('class-table').innerHTML = renderedClassesCache.map((c) => {
      const classId = getClassIdValue(c);
      const teachersDisplay = renderClassTeacherCell(c);
      return `<tr><td class="fw-600">${c.className || '—'}</td><td>${teachersDisplay}</td><td>${fmt(c.feePerDay)}</td><td>${c.timeTable || '—'}</td><td>${c.totalStudents || 0} HV</td><td><button class="btn btn-outline btn-xs" onclick="openClassModal(${classId})">✏️</button> <button class="btn btn-outline btn-xs" onclick="openClassStudentAssignModal(${classId})">👥</button> <button class="btn btn-danger btn-xs" onclick="deleteClassAlert(event, ${classId})">🗑</button></td></tr>`;
    }).join('');
    return;
  }

  $('class-table').innerHTML = '<tr><td colspan="6" class="text-muted text-center">Chưa có lớp học nào</td></tr>';
}

async function openClassModal(id) {
  $('edit-class-id').value = id || '';
  $('modal-class-title').textContent = id ? 'Sửa lớp học' : 'Thêm lớp học mới';
  openModal('modal-class');
  setModalLoading('modal-class', true, 'Đang tải dữ liệu lớp...');

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
  } finally {
    setModalLoading('modal-class', false);
  }
}

async function saveClass(event) {
  setButtonLoading(event, true, 'Đang lưu...');
  const name = $('c-name').value.trim();
  const rate = +$('c-rate').value;
  const schedule = $('c-schedule').value.trim();
  const teacherIds = Array.from($('c-teachers')?.selectedOptions || [])
    .map((option) => Number(option.value))
    .filter((teacherId) => teacherId > 0);

  if (!name || !rate || teacherIds.length === 0) {
    setButtonLoading(event, false);
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
        teacherIds,
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
  } finally {
    setButtonLoading(event, false);
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
  openModal('modal-class-assign-students');
  setModalLoading('modal-class-assign-students', true, 'Đang tải danh sách học sinh...');

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
  } catch (err) {
    showToast(err?.message || 'Không thể tải danh sách học sinh', 'error');
  } finally {
    setModalLoading('modal-class-assign-students', false);
  }
}

async function saveClassStudentAssignment(event) {
  setButtonLoading(event, true, 'Đang cập nhật...');
  const classId = Number($('edit-class-student-id')?.value || 0);
  if (!classId) {
    setButtonLoading(event, false);
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
      teacherIds,
      studentIds,
    });

    closeModal('modal-class-assign-students');
    showToast('Đã cập nhật học sinh trong lớp!');
    renderClasses();
    populateClassSelects();
  } catch (err) {
    showToast(err?.message || 'Lỗi cập nhật học sinh trong lớp', 'error');
  } finally {
    setButtonLoading(event, false);
  }
}

async function deleteClassAlert(event, id) {
  if (!confirm('Xóa lớp này?')) return;
  setButtonLoading(event, true, 'Đang xóa...');
  try {
    await deleteClass(id);
    showToast('Đã xóa lớp');
  } catch (err) {
    showToast(err?.message || 'Lỗi xoá lớp', 'error');
    return;
  } finally {
    setButtonLoading(event, false);
  }
  renderClasses();
  populateClassSelects();
}

Object.assign(window, { renderClasses, openClassModal, saveClass, deleteClassAlert, openClassStudentAssignModal, saveClassStudentAssignment, updateClassStudentSelectionCount, toggleClassTeacherTooltip });
export { renderClasses, openClassModal, saveClass, deleteClassAlert, openClassStudentAssignModal, saveClassStudentAssignment, updateClassStudentSelectionCount, toggleClassTeacherTooltip };