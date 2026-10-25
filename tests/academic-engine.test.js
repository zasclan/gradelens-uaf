import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSummary, parseCsv, projectCgpa, REPEAT_POLICIES } from '../src/academic-engine.js';

const courses = [
  { semester: 'Fall 2024', code: 'CS-101', title: 'Programming', creditHours: 3, qualityPoints: 9, attempt: 1 },
  { semester: 'Spring 2025', code: 'MATH-101', title: 'Calculus', creditHours: 3, qualityPoints: 6, attempt: 1 },
  { semester: 'Fall 2025', code: 'MATH-101', title: 'Calculus', creditHours: 3, qualityPoints: 10.5, attempt: 2 },
];

test('calculates exact CGPA from quality points and credits', () => {
  const result = calculateSummary(courses, REPEAT_POLICIES.ALL);
  assert.equal(result.totalCredits, 9);
  assert.equal(result.totalQualityPoints, 25.5);
  assert.equal(result.cgpa, 2.833);
});

test('latest policy retains the most recent attempt', () => {
  const result = calculateSummary(courses, REPEAT_POLICIES.LATEST);
  assert.equal(result.courseCount, 2);
  assert.equal(result.excludedAttempts, 1);
  assert.equal(result.cgpa, 3.25);
});

test('best policy retains the attempt with the highest grade point', () => {
  const result = calculateSummary([...courses].reverse(), REPEAT_POLICIES.BEST);
  assert.equal(result.cgpa, 3.25);
});

test('rejects impossible quality points', () => {
  assert.throws(() => calculateSummary([{ ...courses[0], qualityPoints: 13 }]), /quality points/);
});

test('projects a future CGPA without mutating the transcript', () => {
  const summary = calculateSummary(courses, REPEAT_POLICIES.LATEST);
  assert.equal(projectCgpa(summary, 6, 4), 3.625);
  assert.equal(summary.cgpa, 3.25);
});

test('imports quoted CSV fields', () => {
  const csv = 'semester,code,title,creditHours,qualityPoints,attempt\n"Fall 2024","CS-101","Programming, Fundamentals",3,9,1';
  const [course] = parseCsv(csv);
  assert.equal(course.title, 'Programming, Fundamentals');
  assert.equal(course.creditHours, 3);
});

test('rejects incomplete CSV schema', () => {
  assert.throws(() => parseCsv('semester,code\nFall,CS-1'), /missing/);
});
