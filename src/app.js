import { calculateSummary, normalizeCourse, parseCsv, projectCgpa, toCsv } from './academic-engine.js';

const STORAGE_KEY = 'gradelens-uaf:courses:v1';
const demoCourses = [
  { semester: 'Semester 1', code: 'CS-101', title: 'Programming Fundamentals', creditHours: 3, qualityPoints: 9.33, attempt: 1 },
  { semester: 'Semester 1', code: 'MATH-101', title: 'Linear Algebra', creditHours: 3, qualityPoints: 7.67, attempt: 1 },
  { semester: 'Semester 2', code: 'CS-201', title: 'Data Structures', creditHours: 3, qualityPoints: 10, attempt: 1 },
  { semester: 'Semester 2', code: 'CS-205', title: 'Database Systems', creditHours: 3, qualityPoints: 9, attempt: 1 },
  { semester: 'Semester 3', code: 'CS-301', title: 'Computer Networks', creditHours: 3, qualityPoints: 11, attempt: 1 },
  { semester: 'Semester 3', code: 'MATH-101', title: 'Linear Algebra', creditHours: 3, qualityPoints: 10, attempt: 2 },
].map(normalizeCourse);

let courses = readCourses();
const $ = (selector) => document.querySelector(selector);

function readCourses() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]').map(normalizeCourse); }
  catch { return []; }
}

function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(courses)); }
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
function download(name, content, type) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click();
  URL.revokeObjectURL(link.href);
}

function render() {
  let summary;
  try { summary = calculateSummary(courses, $('#repeat-policy').value); }
  catch (error) { showToast(error.message); return; }
  $('#cgpa').textContent = courses.length ? summary.cgpa.toFixed(3) : '—';
  $('#hero-cgpa').textContent = courses.length ? summary.cgpa.toFixed(3) : '—';
  $('#credits').textContent = summary.totalCredits;
  $('#quality-points').textContent = summary.totalQualityPoints;
  $('#excluded').textContent = summary.excludedAttempts;
  $('#empty-state').hidden = courses.length > 0;
  $('#course-rows').innerHTML = courses.map((course) => `
    <tr><td>${escapeHtml(course.semester)}</td><td><b>${escapeHtml(course.code)}</b><small>${escapeHtml(course.title)}</small></td><td>${course.creditHours}</td><td>${course.qualityPoints.toFixed(2)}</td><td>${course.attempt}</td><td><button class="delete-row" data-id="${course.id}" aria-label="Delete ${escapeHtml(course.code)}">×</button></td></tr>
  `).join('');
  document.querySelectorAll('.delete-row').forEach((button) => button.addEventListener('click', () => {
    courses = courses.filter((course) => course.id !== button.dataset.id); persist(); render();
  }));
  renderChart(summary);
  updateProjection(summary);
}

function renderChart(summary) {
  const chart = $('#semester-chart');
  const hero = $('#hero-chart');
  if (!summary.semesters.length) { chart.innerHTML = '<p class="chart-empty">Semester performance will appear here.</p>'; hero.innerHTML = ''; return; }
  chart.innerHTML = summary.semesters.map((semester) => {
    const height = Math.max(6, semester.gpa / 4 * 100);
    return `<div class="bar-group"><div class="bar-value">${semester.gpa.toFixed(2)}</div><div class="bar-track"><div class="bar" style="height:${height}%"></div></div><span>${escapeHtml(semester.semester)}</span><small>${semester.credits} credits</small></div>`;
  }).join('');
  hero.innerHTML = summary.semesters.slice(-5).map((semester) => `<i style="height:${Math.max(8, semester.gpa / 4 * 100)}%" title="${escapeHtml(semester.semester)}: ${semester.gpa}"></i>`).join('');
}

function updateProjection(summary = calculateSummary(courses, $('#repeat-policy').value)) {
  try { $('#projected-cgpa').textContent = courses.length ? projectCgpa(summary, $('#planned-credits').value, $('#expected-gp').value).toFixed(3) : '—'; }
  catch { $('#projected-cgpa').textContent = '—'; }
}

$('#add-course').addEventListener('click', () => $('#course-dialog').showModal());
$('#close-dialog').addEventListener('click', () => $('#course-dialog').close());
$('#cancel-dialog').addEventListener('click', () => $('#course-dialog').close());
$('#course-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    courses.push(normalizeCourse(data, courses.length)); persist(); render();
    event.currentTarget.reset(); event.currentTarget.elements.attempt.value = 1; $('#form-error').textContent = ''; $('#course-dialog').close(); showToast('Course added locally.');
  } catch (error) { $('#form-error').textContent = error.message; }
});
$('#repeat-policy').addEventListener('change', render);
$('#planned-credits').addEventListener('input', () => updateProjection());
$('#expected-gp').addEventListener('input', () => updateProjection());
$('#load-demo').addEventListener('click', () => { courses = demoCourses.map((course) => ({ ...course, id: crypto.randomUUID() })); persist(); render(); location.hash = '#workspace'; showToast('Safe demo loaded.'); });
$('#clear-data').addEventListener('click', () => { if (confirm('Delete all GradeLens data stored in this browser?')) { courses = []; localStorage.removeItem(STORAGE_KEY); render(); showToast('Local data cleared.'); } });
$('#export-csv').addEventListener('click', () => { if (!courses.length) return showToast('Add or import courses first.'); download('gradelens-courses.csv', toCsv(courses), 'text/csv'); });
$('#csv-input').addEventListener('change', async (event) => {
  try { courses = parseCsv(await event.target.files[0].text()); persist(); render(); showToast(`${courses.length} courses imported.`); }
  catch (error) { showToast(error.message); }
  event.target.value = '';
});

render();
