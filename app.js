import { $, showToast, today, thisMonth, populateClassSelects, setPage, getListClasses, getListStudents } from './common.js';
import { get as apiGet } from './api.js';
import './dashboard.js';
import './students.js';
import './classes.js';
import './teachers.js';
import './attendance.js';
import './homework.js';
import './tuition-fees.js';
import './receipts.js';
import './reports.js';

const pageTitles = {
  dashboard: 'Tổng quan',
  students: 'Học viên',
  classes: 'Lớp học',
  'teacher-att': 'Điểm danh Giáo viên',
  'student-att': 'Điểm danh Học viên',
  homework: 'Bài tập & Học bài',
  tuition: 'Học phí',
  receipts: 'Phiếu thu',
  reports: 'Báo cáo Doanh thu',
};

let lastApiResultText = '';

const supabaseClient = window.supabase.createClient(
  'https://vmthdbkpnejquzwinjnd.supabase.co',
  'sb_publishable_z2BL69bkYGki5wDvagVZGQ_bpFowUVR'
);

window.supabaseClient = supabaseClient;
window.apiGet = apiGet;
window.getListClasses = getListClasses;
window.getListStudents = getListStudents;

function handleNavigation(page) {
  setPage(page);
  const title = $('page-title');
  if (title) title.textContent = pageTitles[page] || page;

  if (page === 'students') {
    populateClassSelects().then(() => window.initializeStudentsPage?.());
    return;
  }

  if (page === 'dashboard') window.renderDashboard();
  if (page === 'classes') window.renderClasses();
  if (page === 'teacher-att') window.renderTeacherManagementList?.();
  if (page === 'tuition') {
    $('t-month').value = thisMonth();
    populateClassSelects().then(() => window.initializeTuitionPage?.());
    return;
  }
  if (page === 'receipts') {
    if ($('rc-filter-month')) $('rc-filter-month').value = thisMonth();
    window.filterReceipts();
  }
  if (page === 'reports') {
    $('rpt-year').value = new Date().getFullYear();
    if ($('rpt-month')) $('rpt-month').value = thisMonth();
    window.renderReport();
  }

  populateClassSelects();
}

export function switchAttTab(id, btn) {
  document.querySelectorAll('#page-student-att .tab-pane').forEach((pane) => pane.classList.remove('active'));
  document.querySelectorAll('#page-student-att .tab-btn').forEach((tab) => tab.classList.remove('active'));
  $(id)?.classList.add('active');
  btn?.classList.add('active');
}

export function switchHWTab(id, btn) {
  document.querySelectorAll('#page-homework .tab-pane').forEach((pane) => pane.classList.remove('active'));
  document.querySelectorAll('#page-homework .tab-btn').forEach((tab) => tab.classList.remove('active'));
  $(id)?.classList.add('active');
  btn?.classList.add('active');
}

export function switchReceiptTab(id, btn) {
  document.querySelectorAll('#page-receipts .tab-pane').forEach((pane) => pane.classList.remove('active'));
  document.querySelectorAll('#page-receipts .tab-btn').forEach((tab) => tab.classList.remove('active'));
  $(id)?.classList.add('active');
  btn?.classList.add('active');
}

function init() {
  if ($('satt-month')) $('satt-month').value = thisMonth();
  $('hw-date').value = today();
  if ($('hw-report-month')) $('hw-report-month').value = thisMonth();
  $('tatt-month').value = thisMonth();
  $('t-month').value = thisMonth();
  if ($('rc-filter-month')) $('rc-filter-month').value = thisMonth();
  $('rpt-year').value = new Date().getFullYear();
  if ($('rpt-month')) $('rpt-month').value = thisMonth();

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => handleNavigation(item.dataset.page));
  });

  window.switchAttTab = switchAttTab;
  window.switchHWTab = switchHWTab;
  window.switchReceiptTab = switchReceiptTab;

  handleNavigation('dashboard');
}

init();
