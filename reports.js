import { $, fmt, showToast, getTuitionRows, getReceiptRows, thisMonth, setButtonLoading, showTableLoading } from './common.js';

async function getMonthAggregate(month) {
  const [tuitionRows, receiptRows] = await Promise.all([
    getTuitionRows(month),
    getReceiptRows(month),
  ]);

  const paid = tuitionRows.filter((row) => row.status === 'paid').length;
  const unpaid = tuitionRows.filter((row) => row.status !== 'paid' && row.status !== 'no-data').length;
  const totalPaid = tuitionRows.reduce((sum, row) => sum + Number(row.paid || 0), 0);
  const totalOwed = tuitionRows.reduce((sum, row) => sum + Number(row.remaining || 0), 0);

  const paidFull = new Set(receiptRows.filter((r) => Number(r.remaining || 0) <= 0).map((r) => Number(r.studentId || 0)));
  const debtors = new Set(receiptRows.filter((r) => Number(r.remaining || 0) > 0).map((r) => Number(r.studentId || 0)));

  return {
    month,
    receiptCount: receiptRows.length,
    revenue: totalPaid,
    paid,
    unpaid,
    paidFull: paidFull.size,
    debtors: debtors.size,
    totalOwed,
  };
}

function renderMonthlyKpis(aggregate, selectedMonth) {
  const [year, month] = String(selectedMonth || '').split('-');
  const scopeText = month && year ? `tháng ${month}/${year}` : 'tháng đã chọn';

  $('rpt-paid').textContent = String(aggregate.paid || 0);
  $('rpt-unpaid').textContent = String(aggregate.unpaid || 0);
  $('rpt-total').textContent = fmt(aggregate.revenue || 0);
  $('rpt-owed').textContent = fmt(aggregate.totalOwed || 0);

  $('rpt-paid-sub').textContent = `học viên ${scopeText}`;
  $('rpt-unpaid-sub').textContent = `học viên ${scopeText}`;
  $('rpt-total-sub').textContent = scopeText;
  $('rpt-owed-sub').textContent = scopeText;
}

async function buildYearlyData(year) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

  const aggregates = await Promise.all(months.map((month) => getMonthAggregate(month)));

  return aggregates.map((item, index) => ({
    ...item,
    label: monthNames[index],
  }));
}

async function renderReport(event) {
  setButtonLoading(event, true, 'Đang tải...');
  showTableLoading('report-table', 6, 'Đang tải báo cáo...');
  const year = +$('rpt-year').value || new Date().getFullYear();
  const currentYear = new Date().getFullYear();
  const defaultMonth = year === currentYear ? thisMonth() : `${year}-01`;
  const selectedMonth = $('rpt-month').value || defaultMonth;
  $('rpt-month').value = selectedMonth;

  try {
    const [yearData, selectedMonthAggregate] = await Promise.all([
      buildYearlyData(year),
      getMonthAggregate(selectedMonth),
    ]);

    renderMonthlyKpis(selectedMonthAggregate, selectedMonth);

    const maxRev = Math.max(...yearData.map((d) => d.revenue), 1);
    $('report-chart').innerHTML = yearData.map((d) => {
      const h = Math.max(4, Math.round((d.revenue / maxRev) * 160));
      return `<div class="chart-bar-item"><div class="chart-bar-val" style="font-size:9px">${d.revenue > 0 ? (d.revenue / 1000000).toFixed(1) + 'M' : ''}</div><div class="chart-bar-fill" style="height:${h}px"></div><div class="chart-bar-label">${d.label}</div></div>`;
    }).join('');

    $('report-table').innerHTML = yearData.map((d) => {
      return `<tr><td class="fw-600">${d.label}/${year}</td><td>${d.receiptCount}</td><td style="color:var(--green);font-weight:600">${fmt(d.revenue)}</td><td><span class="badge badge-green">${d.paidFull}</span></td><td><span class="badge badge-red">${d.debtors}</span></td><td style="color:var(--red)">${d.totalOwed > 0 ? fmt(d.totalOwed) : '—'}</td></tr>`;
    }).join('');
  } catch (err) {
    $('report-chart').innerHTML = '<p class="text-muted text-center">Không tải được dữ liệu biểu đồ.</p>';
    $('report-table').innerHTML = '<tr><td colspan="6" class="text-muted text-center">Không tải được dữ liệu báo cáo</td></tr>';
    renderMonthlyKpis({ paid: 0, unpaid: 0, revenue: 0, totalOwed: 0 }, selectedMonth);
    showToast(err?.message || 'Không thể tải báo cáo doanh thu', 'error');
  } finally {
    setButtonLoading(event, false);
  }
}

async function exportReport() {
  const year = +$('rpt-year').value || new Date().getFullYear();

  try {
    const data = await buildYearlyData(year);
    const lines = ['Tháng,Số phiếu thu,Doanh thu,HV nộp đủ,HV còn nợ,Tiền còn nợ'];

    data.forEach((d, i) => {
      lines.push(`T${i + 1}/${year},${d.receiptCount},${d.revenue},${d.paidFull},${d.debtors},${d.totalOwed}`);
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bao-cao-doanh-thu-${year}.csv`;
    a.click();
    showToast('Đã xuất báo cáo CSV!');
  } catch (err) {
    showToast(err?.message || 'Không thể xuất báo cáo', 'error');
  }
}

Object.assign(window, { renderReport, exportReport });
export { renderReport, exportReport };
