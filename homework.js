import { $, showToast, getClassName, getListClasses, getStudentsByClass, getStudentsHomework, updateStudentsHomework } from './common.js';

let homeworkState = null;
let isSavingHomework = false;

function toNonNegativeInt(value) {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < 0) return 0;
	return parsed;
}

function normalizeStudents(rows) {
	return (Array.isArray(rows) ? rows : [])
		.map((student) => ({
			studentId: Number(student?.studentId ?? student?.id ?? student?.student_id ?? 0),
			fullName: student?.fullName ?? student?.name ?? student?.studentFullName ?? '—',
		}))
		.filter((student) => student.studentId > 0);
}

function normalizeHomeworkResponse(payload) {
	return (Array.isArray(payload?.students) ? payload.students : [])
		.map((student) => ({
			studentId: Number(student?.studentId ?? student?.id ?? student?.student_id ?? 0),
			fullName: student?.fullName ?? student?.name ?? '—',
			records: (Array.isArray(student?.records) ? student.records : []).map((record) => ({
				date: String(record?.date ?? '').trim(),
				homeworkCompleted: toNonNegativeInt(record?.homeworkCompleted),
				homeworkTotal: toNonNegativeInt(record?.homeworkTotal),
				reviewCompleted: toNonNegativeInt(record?.reviewCompleted),
				reviewTotal: toNonNegativeInt(record?.reviewTotal),
				notes: String(record?.notes ?? ''),
			})),
		}))
		.filter((student) => student.studentId > 0);
}

function formatRate(completed, total) {
	const safeTotal = toNonNegativeInt(total);
	if (!safeTotal) return '—';
	const safeCompleted = Math.min(toNonNegativeInt(completed), safeTotal);
	return `${Math.round((safeCompleted / safeTotal) * 100)}%`;
}

function sanitizePair(completed, total) {
	const safeTotal = toNonNegativeInt(total);
	if (!safeTotal) return { completed: 0, total: 0 };
	const safeCompleted = Math.min(toNonNegativeInt(completed), safeTotal);
	return { completed: safeCompleted, total: safeTotal };
}

function findRecordByDate(students, studentId, date) {
	const student = students.find((item) => item.studentId === Number(studentId));
	if (!student) return null;
	return student.records.find((record) => record.date === date) || null;
}

function readRowValues(studentId) {
	return {
		homeworkCompleted: toNonNegativeInt($(`hw-homework-completed-${studentId}`)?.value),
		homeworkTotal: toNonNegativeInt($(`hw-homework-total-${studentId}`)?.value),
		reviewCompleted: toNonNegativeInt($(`hw-review-completed-${studentId}`)?.value),
		reviewTotal: toNonNegativeInt($(`hw-review-total-${studentId}`)?.value),
		notes: ($(`hw-notes-${studentId}`)?.value || '').trim(),
	};
}

function updateRowRate(studentId) {
	const row = readRowValues(studentId);
	const homeworkRateEl = $(`hw-homework-rate-${studentId}`);
	const reviewRateEl = $(`hw-review-rate-${studentId}`);
	if (homeworkRateEl) homeworkRateEl.textContent = formatRate(row.homeworkCompleted, row.homeworkTotal);
	if (reviewRateEl) reviewRateEl.textContent = formatRate(row.reviewCompleted, row.reviewTotal);
}

function renderHomeworkTable() {
	if (!homeworkState) {
		$('hw-content').innerHTML = '<p class="text-muted text-center">Chọn lớp và ngày để ghi nhận bài tập.</p>';
		return;
	}

	const rows = homeworkState.students.map((student, index) => {
		const record = homeworkState.recordByStudentId.get(student.studentId) || {};
		const homeworkCompleted = toNonNegativeInt(record.homeworkCompleted);
		const homeworkTotal = toNonNegativeInt(record.homeworkTotal);
		const reviewCompleted = toNonNegativeInt(record.reviewCompleted);
		const reviewTotal = toNonNegativeInt(record.reviewTotal);
		const notes = String(record.notes ?? '');

		return `
			<tr>
				<td>${index + 1}</td>
				<td class="fw-600">${student.fullName}</td>
				<td>
					<div class="flex gap-8 items-center">
						<input type="number" min="0" class="form-control" id="hw-homework-completed-${student.studentId}" value="${homeworkCompleted}" style="width:84px" oninput="recalcHomeworkRow(${student.studentId})">
						<span>/</span>
						<input type="number" min="0" class="form-control" id="hw-homework-total-${student.studentId}" value="${homeworkTotal}" style="width:84px" oninput="recalcHomeworkRow(${student.studentId})">
					</div>
				</td>
				<td><span class="badge badge-gray" id="hw-homework-rate-${student.studentId}">${formatRate(homeworkCompleted, homeworkTotal)}</span></td>
				<td>
					<div class="flex gap-8 items-center">
						<input type="number" min="0" class="form-control" id="hw-review-completed-${student.studentId}" value="${reviewCompleted}" style="width:84px" oninput="recalcHomeworkRow(${student.studentId})">
						<span>/</span>
						<input type="number" min="0" class="form-control" id="hw-review-total-${student.studentId}" value="${reviewTotal}" style="width:84px" oninput="recalcHomeworkRow(${student.studentId})">
					</div>
				</td>
				<td><span class="badge badge-gray" id="hw-review-rate-${student.studentId}">${formatRate(reviewCompleted, reviewTotal)}</span></td>
				<td><input class="form-control" id="hw-notes-${student.studentId}" value="${notes.replaceAll('"', '&quot;')}" placeholder="Ghi chú"></td>
			</tr>
		`;
	}).join('');

	$('hw-content').innerHTML = `
		<div class="tbl-wrap">
			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>Học viên</th>
						<th>BTVN (làm/tổng)</th>
						<th>Tỉ lệ BTVN</th>
						<th>Dò bài (thuộc/tổng)</th>
						<th>Tỉ lệ dò bài</th>
						<th>Ghi chú</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
		</div>
		<div class="mt-16"><button class="btn btn-success" onclick="saveHomework()">✓ Lưu ghi nhận</button></div>
	`;
}

async function loadHomework() {
	const classId = Number($('hw-class-select')?.value || 0);
	const date = String($('hw-date')?.value || '').trim();
	if (!classId || !date) {
		showToast('Chọn lớp và ngày!', 'error');
		return;
	}

	const month = date.slice(0, 7);

	try {
		const [studentsInClass, payload] = await Promise.all([
			getStudentsByClass(classId),
			getStudentsHomework(classId, month),
		]);

		const students = normalizeStudents(studentsInClass);
		if (!students.length) {
			showToast('Lớp chưa có học viên!', 'error');
			return;
		}

		const studentsFromHomework = normalizeHomeworkResponse(payload);
		const recordByStudentId = new Map();
		students.forEach((student) => {
			const record = findRecordByDate(studentsFromHomework, student.studentId, date);
			if (record) {
				recordByStudentId.set(student.studentId, record);
			}
		});

		homeworkState = {
			classId,
			date,
			month,
			students,
			recordByStudentId,
		};

		renderHomeworkTable();
		showToast('Đã tải danh sách bài tập');
	} catch (err) {
		showToast(err?.message || 'Không thể tải dữ liệu bài tập', 'error');
	}
}

async function saveHomework() {
	if (!homeworkState) {
		showToast('Vui lòng tải danh sách trước', 'error');
		return;
	}
	if (isSavingHomework) return;

	const selectedClassId = Number($('hw-class-select')?.value || 0);
	const selectedDate = String($('hw-date')?.value || '').trim();
	if (selectedClassId !== homeworkState.classId || selectedDate !== homeworkState.date) {
		showToast('Lớp hoặc ngày đã thay đổi, vui lòng tải lại danh sách', 'error');
		return;
	}

	const studentsPayload = homeworkState.students.map((student) => {
		const row = readRowValues(student.studentId);
		const homeworkPair = sanitizePair(row.homeworkCompleted, row.homeworkTotal);
		const reviewPair = sanitizePair(row.reviewCompleted, row.reviewTotal);

		return {
			studentId: student.studentId,
			homeworkCompleted: homeworkPair.completed,
			homeworkTotal: homeworkPair.total,
			reviewCompleted: reviewPair.completed,
			reviewTotal: reviewPair.total,
			notes: row.notes,
		};
	});

	isSavingHomework = true;

	try {
		await updateStudentsHomework({
			classId: homeworkState.classId,
			date: homeworkState.date,
			students: studentsPayload,
		});
		showToast('Đã lưu ghi nhận bài tập!');
		await loadHomework();
	} catch (err) {
		showToast(err?.message || 'Không thể lưu dữ liệu bài tập', 'error');
	} finally {
		isSavingHomework = false;
	}
}

function progressBar(rate, total) {
	if (!total) return '<span class="text-muted">—</span>';
	const color = rate >= 80 ? 'green' : rate >= 60 ? 'yellow' : 'red';
	return `<div style="display:flex;align-items:center;gap:6px"><div class="progress-bar" style="width:70px"><div class="progress-fill ${color}" style="width:${rate}%"></div></div><span style="font-size:11px;font-weight:600">${rate}%</span></div>`;
}

function appendStudentSummary(map, className, student) {
	const key = student.studentId;
	if (!map.has(key)) {
		map.set(key, {
			studentId: key,
			fullName: student.fullName,
			classNames: new Set(),
			homeworkCompleted: 0,
			homeworkTotal: 0,
			reviewCompleted: 0,
			reviewTotal: 0,
		});
	}

	const summary = map.get(key);
	if (className) summary.classNames.add(className);

	const records = Array.isArray(student.records) ? student.records : [];
	records.forEach((record) => {
		summary.homeworkCompleted += toNonNegativeInt(record.homeworkCompleted);
		summary.homeworkTotal += toNonNegativeInt(record.homeworkTotal);
		summary.reviewCompleted += toNonNegativeInt(record.reviewCompleted);
		summary.reviewTotal += toNonNegativeInt(record.reviewTotal);
	});
}

async function renderHWReport() {
	const classId = Number($('hw-report-class')?.value || 0);
	const month = String($('hw-report-month')?.value || '').trim();
	if (!month) {
		showToast('Chọn tháng để xem báo cáo', 'error');
		return;
	}

	try {
		const classes = await getListClasses();
		const classMap = new Map(
			classes.map((cls) => {
				const id = Number(cls?.id ?? cls?.classId ?? cls?.class_id ?? 0);
				const name = cls?.class_name ?? cls?.name ?? cls?.className ?? '—';
				return [id, name];
			}).filter(([id]) => id > 0)
		);

		const classIds = classId
			? [classId]
			: classes
				.map((cls) => Number(cls?.id ?? cls?.classId ?? cls?.class_id ?? 0))
				.filter((id) => id > 0);

		if (!classIds.length) {
			$('hw-report-body').innerHTML = '<p class="text-muted text-center">Chưa có lớp để lập báo cáo.</p>';
			return;
		}

		const responses = await Promise.all(
			classIds.map(async (id) => ({
				classId: id,
				payload: await getStudentsHomework(id, month),
			}))
		);

		const summaryByStudent = new Map();
		responses.forEach((item) => {
			const students = normalizeHomeworkResponse(item.payload);
			const className = classMap.get(item.classId) || getClassName(item.classId);
			students.forEach((student) => appendStudentSummary(summaryByStudent, className, student));
		});

		const rows = Array.from(summaryByStudent.values())
			.sort((a, b) => a.fullName.localeCompare(b.fullName))
			.map((student) => {
				const homeworkRate = student.homeworkTotal ? Math.round((Math.min(student.homeworkCompleted, student.homeworkTotal) / student.homeworkTotal) * 100) : 0;
				const reviewRate = student.reviewTotal ? Math.round((Math.min(student.reviewCompleted, student.reviewTotal) / student.reviewTotal) * 100) : 0;
				const className = Array.from(student.classNames).join(', ') || '—';

				return `
					<tr>
						<td class="fw-600">${student.fullName}</td>
						<td>${className}</td>
						<td><span class="badge badge-green">${student.homeworkCompleted}/${student.homeworkTotal}</span></td>
						<td>${progressBar(homeworkRate, student.homeworkTotal)}</td>
						<td><span class="badge badge-green">${student.reviewCompleted}/${student.reviewTotal}</span></td>
						<td>${progressBar(reviewRate, student.reviewTotal)}</td>
					</tr>
				`;
			}).join('');

		$('hw-report-body').innerHTML = `
			<div class="tbl-wrap">
				<table>
					<thead>
						<tr>
							<th>Học viên</th>
							<th>Lớp</th>
							<th>BTVN</th>
							<th>Tỉ lệ BTVN</th>
							<th>Dò bài</th>
							<th>Tỉ lệ dò bài</th>
						</tr>
					</thead>
					<tbody>${rows || '<tr><td colspan="6" class="text-muted text-center">Chưa có dữ liệu ghi nhận</td></tr>'}</tbody>
				</table>
			</div>
		`;
	} catch (err) {
		$('hw-report-body').innerHTML = '<p class="text-muted text-center">Không tải được dữ liệu báo cáo.</p>';
		showToast(err?.message || 'Không thể tải báo cáo bài tập', 'error');
	}
}

window.recalcHomeworkRow = updateRowRate;
Object.assign(window, { loadHomework, saveHomework, renderHWReport });
export { loadHomework, saveHomework, renderHWReport };