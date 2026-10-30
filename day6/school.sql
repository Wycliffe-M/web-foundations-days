PRAGMA foreign_keys = ON;

CREATE TABLE students (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  email  TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  id     INTEGER PRIMARY KEY,
  title  TEXT NOT NULL UNIQUE,
  credits INTEGER NOT NULL
);

CREATE TABLE enrolments (
  student_id  INTEGER NOT NULL,
  course_id   INTEGER NOT NULL,
  grade       TEXT,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE
);

INSERT INTO students (name, email) VALUES
  ('Amina Otieno', 'amina@school.ac.ke'),
  ('Brian Kamau', 'brian@school.ac.ke'),
  ('Cynthia Wanjiru', 'cynthia@school.ac.ke'),
  ('David Mwangi', 'david@school.ac.ke');

INSERT INTO courses (title, credits) VALUES
  ('Web Foundations', 4),
  ('Databases', 3),
  ('Networking', 3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 'A'),
  (1, 2, 'B'),
  (2, 1, 'B'),
  (2, 3, NULL),
  (3, 2, 'A');

-- Index: speeds up "all students on a course" and "students per course"
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);

-- Query 1: all courses for one student (by name)
SELECT courses.title, enrolments.grade
FROM students
JOIN enrolments ON enrolments.student_id = students.id
JOIN courses ON courses.id = enrolments.course_id
WHERE students.name = 'Amina Otieno';

-- Query 2: all students on one course
SELECT students.name, enrolments.grade
FROM courses
JOIN enrolments ON enrolments.course_id = courses.id
JOIN students ON students.id = enrolments.student_id
WHERE courses.title = 'Web Foundations';

-- Query 3: number of students per course
SELECT courses.title, COUNT(enrolments.student_id) AS student_count
FROM courses
LEFT JOIN enrolments ON enrolments.course_id = courses.id
GROUP BY courses.id;

-- Query 4: students who have no enrolments
SELECT students.name
FROM students
LEFT JOIN enrolments ON enrolments.student_id = students.id
WHERE enrolments.student_id IS NULL;

-- Query 5: update one enrolment's grade
UPDATE enrolments
SET grade = 'B'
WHERE student_id = 2 AND course_id = 3;