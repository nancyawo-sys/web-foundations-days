PRAGMA foreign_keys = ON;

-- 1. Tables
CREATE TABLE students (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  email  TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  id      INTEGER PRIMARY KEY,
  title   TEXT NOT NULL,
  credits INTEGER NOT NULL
);

CREATE TABLE enrolments (
  student_id  INTEGER NOT NULL,
  course_id   INTEGER NOT NULL,
  grade       INTEGER,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE
);

-- 2. Sample data
INSERT INTO students (name, email) VALUES
  ('Amina Otieno', 'amina@example.com'),
  ('Brian Kamau', 'brian@example.com'),
  ('Grace Wanjiku', 'grace@example.com'),
  ('Nancy Awuor', 'nancy@example.com');

INSERT INTO courses (title, credits) VALUES
  ('Web Foundations', 4),
  ('Databases', 3),
  ('Mathematics', 3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 85),
  (1, 2, 78),
  (2, 1, 66),
  (3, 1, 92),
  (3, 3, 71),
  (2, 3, 58);

-- 3. Queries

-- a) All courses for one student (by name)
SELECT courses.title, enrolments.grade
FROM students
JOIN enrolments ON enrolments.student_id = students.id
JOIN courses ON courses.id = enrolments.course_id
WHERE students.name = 'Amina Otieno';

-- b) All students on one course
SELECT students.name, students.email
FROM courses
JOIN enrolments ON enrolments.course_id = courses.id
JOIN students ON students.id = enrolments.student_id
WHERE courses.title =
