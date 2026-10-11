# School Database Design

## Tables

- **students**: one row per student. Columns: `id` (primary key), `name`, and `email` (unique, so two students cannot share an email).
- **courses**: one row per course. Columns: `id` (primary key), `title` and `credits`.
- **enrolments**: one row each time a student is enrolled on a course. Columns: `student_id` and `course_id` (both foreign keys) and `grade`. Its primary key is the pair `(student_id, course_id)`.

## Relationships

- One student can be enrolled on many courses, and one course has many students. This is a **many-to-many** relationship.
- Each student has **one-to-many** enrolments, and each course has **one-to-many** enrolments. Every enrolment row belongs to exactly one student and one course.
- A join table is needed because one column cannot hold many course ids without breaking the rule of one value per column. `enrolments` stores one row per student-course pair. It is also the right place for the grade, because the grade belongs to the pairing and not to the student or the course alone.
- The pair `(student_id, course_id)` is the primary key, so the same student cannot enrol on the same course twice.

## Index

I would add an index on `enrolments(course_id)`:

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);
```

The primary key already speeds up searches that start with `student_id`, but finding all the students on a course searches by `course_id`. An index lets the database jump straight to those rows instead of checking every enrolment.

## SQL or NoSQL?

I would choose SQL for this system. The data is clearly structured, with students, courses and enrolments that have fixed columns and clear relationships. SQL handles these relationships well with foreign keys and JOINs, and it enforces rules such as unique emails and no duplicate enrolments inside the database itself. Grades need to stay correct, which suits the strict rules of a relational database. A document database would be more useful if the data had very flexible shapes or had to spread across many servers, and a school system does not need that.
