// import { $, DB, getClassName, showToast } from './common.js';

// function loadHomework() {
//   const classId = +$('hw-class-select').value;
//   const date = $('hw-date').value;
//   if (!classId || !date) return showToast('Chọn lớp và ngày!', 'error');
//   const students = DB.students.filter((s) => s.classId === classId);
//   if (!students.length) return showToast('Lớp chưa có học viên!', 'error');

//   $('hw-content').innerHTML = `
//     <table>
//       <thead><tr><th>#</th><th>Học viên</th><th>Bài tập về nhà</th><th>Học bài cũ</th></tr></thead>
//       <tbody id="hw-tbody"></tbody>
//     </table>
//     <div class="mt-16"><button class="btn btn-success" onclick="saveHomework(${classId},'${date}')">✓ Lưu</button></div>
//   `;

//   $('hw-tbody').innerHTML = students.map((s, i) => {
//     const existing = DB.homework.find((h) => h.studentId === s.id && h.date === date);
//     return `<tr><td>${i + 1}</td><td class="fw-600">${s.name}</td><td><select class="form-control" id="hw-btvn-${s.id}" style="width:auto"><option value="done" ${(!existing || existing.btvn) ? 'selected' : ''}>✓ Hoàn thành</option><option value="notdone" ${(existing && !existing.btvn) ? 'selected' : ''}>✗ Không hoàn thành</option></select></td><td><select class="form-control" id="hw-hbc-${s.id}" style="width:auto"><option value="done" ${(!existing || existing.hbc) ? 'selected' : ''}>✓ Thuộc bài</option><option value="notdone" ${(existing && !existing.hbc) ? 'selected' : ''}>✗ Chưa thuộc</option></select></td></tr>`;
//   }).join('');
// }

// function saveHomework(classId, date) {
//   const students = DB.students.filter((s) => s.classId === classId);
//   students.forEach((s) => {
//     const btvn = $('hw-btvn-' + s.id)?.value === 'done';
//     const hbc = $('hw-hbc-' + s.id)?.value === 'done';
//     const idx = DB.homework.findIndex((h) => h.studentId === s.id && h.date === date);
//     if (idx >= 0) { DB.homework[idx].btvn = btvn; DB.homework[idx].hbc = hbc; }
//     else DB.homework.push({ studentId: s.id, classId, date, btvn, hbc });
//   });
//   showToast('Đã lưu ghi nhận bài tập!');
// }

// function renderHWReport() {
//   const classId = $('hw-report-class').value;
//   const period = $('hw-report-period').value;
//   const students = classId ? DB.students.filter((s) => s.classId === +classId) : DB.students;
//   let dateFilter = () => true;
//   const now = new Date();
//   if (period === 'week') {
//     const weekAgo = new Date(now - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
//     dateFilter = (d) => d >= weekAgo;
//   } else {
//     const semStart = now.getMonth() < 6 ? `${now.getFullYear()}-01-01` : `${now.getFullYear()}-07-01`;
//     dateFilter = (d) => d >= semStart;
//   }

//   $('hw-report-body').innerHTML = `<table><thead><tr><th>Học viên</th><th>Lớp</th><th>BTVN đạt</th><th>BTVN không đạt</th><th>Tỉ lệ BTVN</th><th>Học bài đạt</th><th>Học bài không đạt</th><th>Tỉ lệ học bài</th></tr></thead><tbody>${students.map((s) => {
//     const records = DB.homework.filter((h) => h.studentId === s.id && dateFilter(h.date));
//     const btvnDone = records.filter((h) => h.btvn).length;
//     const hbcDone = records.filter((h) => h.hbc).length;
//     const total = records.length;
//     const rBtvn = total > 0 ? Math.round((btvnDone / total) * 100) : 0;
//     const rHbc = total > 0 ? Math.round((hbcDone / total) * 100) : 0;
//     const bar = (r) => `<div style="display:flex;align-items:center;gap:6px"><div class="progress-bar" style="width:60px"><div class="progress-fill ${r >= 80 ? 'green' : r >= 60 ? 'yellow' : 'red'}" style="width:${r}%"></div></div><span style="font-size:11px;font-weight:600">${r}%</span></div>`;
//     return `<tr><td class="fw-600">${s.name}</td><td>${getClassName(s.classId)}</td><td><span class="badge badge-green">${btvnDone}</span></td><td><span class="badge badge-red">${total - btvnDone}</span></td><td>${bar(rBtvn)}</td><td><span class="badge badge-green">${hbcDone}</span></td><td><span class="badge badge-red">${total - hbcDone}</span></td><td>${bar(rHbc)}</td></tr>`;
//   }).join('') || '<tr><td colspan="8" class="text-muted text-center">Chưa có dữ liệu ghi nhận</td></tr>'}</tbody></table>`;
// }

// window.switchHWTab = function (id, btn) { window.switchTab('#page-homework', id, btn); };
// Object.assign(window, { loadHomework, saveHomework, renderHWReport });
// export { loadHomework, saveHomework, renderHWReport };