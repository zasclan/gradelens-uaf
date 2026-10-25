export const REPEAT_POLICIES = Object.freeze({
  ALL: 'all',
  LATEST: 'latest',
  BEST: 'best',
});

const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function normalizeCourse(input, index = 0) {
  const semester = String(input.semester ?? '').trim();
  const code = String(input.code ?? '').trim().toUpperCase();
  const title = String(input.title ?? '').trim();
  const creditHours = Number(input.creditHours);
  const qualityPoints = Number(input.qualityPoints);
  const attempt = Number(input.attempt ?? 1);

  if (!semester) throw new Error(`Row ${index + 1}: semester is required.`);
  if (!code) throw new Error(`Row ${index + 1}: course code is required.`);
  if (!title) throw new Error(`Row ${index + 1}: course title is required.`);
  if (!Number.isFinite(creditHours) || creditHours <= 0 || creditHours > 10) {
    throw new Error(`Row ${index + 1}: credit hours must be between 0 and 10.`);
  }
  if (!Number.isFinite(qualityPoints) || qualityPoints < 0 || qualityPoints > creditHours * 4) {
    throw new Error(`Row ${index + 1}: quality points must be between 0 and ${creditHours * 4}.`);
  }
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error(`Row ${index + 1}: attempt must be a positive integer.`);
  }

  return {
    id: String(input.id ?? crypto.randomUUID()),
    semester,
    code,
    title,
    creditHours: round(creditHours, 2),
    qualityPoints: round(qualityPoints, 2),
    attempt,
  };
}

export function selectAttempts(courses, policy = REPEAT_POLICIES.ALL) {
  if (!Object.values(REPEAT_POLICIES).includes(policy)) {
    throw new Error(`Unknown repeat policy: ${policy}`);
  }
  if (policy === REPEAT_POLICIES.ALL) return [...courses];

  const selected = new Map();
  courses.forEach((course, position) => {
    const key = course.code.toUpperCase();
    const current = selected.get(key);
    const gradePoint = course.qualityPoints / course.creditHours;
    const currentGradePoint = current?.course.qualityPoints / current?.course.creditHours;
    const replace = !current ||
      (policy === REPEAT_POLICIES.LATEST && (
        course.attempt > current.course.attempt ||
        (course.attempt === current.course.attempt && position > current.position)
      )) ||
      (policy === REPEAT_POLICIES.BEST && gradePoint > currentGradePoint);
    if (replace) selected.set(key, { course, position });
  });
  return [...selected.values()].sort((a, b) => a.position - b.position).map(({ course }) => course);
}

export function calculateSummary(rawCourses, policy = REPEAT_POLICIES.ALL) {
  const courses = rawCourses.map(normalizeCourse);
  const countedCourses = selectAttempts(courses, policy);
  const totalCredits = countedCourses.reduce((sum, course) => sum + course.creditHours, 0);
  const totalQualityPoints = countedCourses.reduce((sum, course) => sum + course.qualityPoints, 0);
  const cgpa = totalCredits ? totalQualityPoints / totalCredits : 0;

  const semesterMap = new Map();
  countedCourses.forEach((course) => {
    const aggregate = semesterMap.get(course.semester) ?? { credits: 0, qualityPoints: 0, courseCount: 0 };
    aggregate.credits += course.creditHours;
    aggregate.qualityPoints += course.qualityPoints;
    aggregate.courseCount += 1;
    semesterMap.set(course.semester, aggregate);
  });

  const semesters = [...semesterMap.entries()].map(([semester, values]) => ({
    semester,
    credits: round(values.credits),
    qualityPoints: round(values.qualityPoints),
    gpa: round(values.qualityPoints / values.credits, 3),
    courseCount: values.courseCount,
  }));

  return {
    policy,
    courseCount: countedCourses.length,
    excludedAttempts: courses.length - countedCourses.length,
    totalCredits: round(totalCredits),
    totalQualityPoints: round(totalQualityPoints),
    cgpa: round(cgpa, 3),
    semesters,
    countedCourses,
  };
}

export function projectCgpa(summary, plannedCredits, expectedGradePoint) {
  const credits = Number(plannedCredits);
  const gradePoint = Number(expectedGradePoint);
  if (!Number.isFinite(credits) || credits <= 0) throw new Error('Planned credits must be greater than zero.');
  if (!Number.isFinite(gradePoint) || gradePoint < 0 || gradePoint > 4) {
    throw new Error('Expected grade point must be between 0 and 4.');
  }
  return round(
    (summary.totalQualityPoints + credits * gradePoint) / (summary.totalCredits + credits),
    3,
  );
}

export function parseCsv(text) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('CSV must include a header and at least one course.');
  const parseLine = (line) => {
    const cells = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; }
      else value += char;
    }
    cells.push(value.trim());
    return cells;
  };
  const headers = parseLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z]/g, ''));
  const required = ['semester', 'code', 'title', 'credithours', 'qualitypoints'];
  required.forEach((header) => {
    if (!headers.includes(header)) throw new Error(`CSV is missing the ${header} column.`);
  });
  return lines.slice(1).map((line, index) => {
    const cells = parseLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? '']));
    return normalizeCourse({
      semester: row.semester,
      code: row.code,
      title: row.title,
      creditHours: row.credithours,
      qualityPoints: row.qualitypoints,
      attempt: row.attempt || 1,
    }, index);
  });
}

export function toCsv(courses) {
  const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
  return [
    'semester,code,title,creditHours,qualityPoints,attempt',
    ...courses.map((course) => [course.semester, course.code, course.title, course.creditHours, course.qualityPoints, course.attempt].map(escape).join(',')),
  ].join('\n');
}
