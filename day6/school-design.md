# School Database Design

## Tables

**students** stores one row for each student. It has an `id` (primary key), a `name`, and an `email`. The email is `UNIQUE`, so two students can't register with the same address.

**courses** stores one row for each course. It has an `id` (primary key), a `title` (also `UNIQUE`) and the number of `credits`.

**enrolments** records the fact that a student is taking a course. Each row holds a `student_id`, a `course_id` and a `grade`. The `grade` can be empty (`NULL`) because a student is enrolled before any grade exists. Both ids are foreign keys, so an enrolment can only point to a real student and a real course.

## Relationships

One student can have many enrolments, and one course can have many enrolments, so each of those links is **one-to-many**. Put together, students and courses have a **many-to-many** relationship: a student takes many courses, and a course has many students.

A many-to-many relationship needs a **join table** because a single column can't hold a list of ids in a relational database. Storing something like `courses = "1,2"` in the students table would be hard to search and update. The `enrolments` table solves this by storing one row for each student and course pair, and it also gives the grade somewhere to live, since a grade belongs to the pair rather than to the student or the course alone.

The primary key of `enrolments` is the pair `(student_id, course_id)`. This stops the same student enrolling on the same course twice.

## Index

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);
```

The primary key `(student_id, course_id)` already helps when searching by student. Searching by `course_id` alone ("all students on this course", or counting students per course) can't use it well, so the database would have to read every enrolment. An index on `course_id` lets it jump straight to the matching rows. The trade-off is that writes become slightly slower and the index uses some extra storage.

## SQL or NoSQL?

I would choose SQL (a relational database such as PostgreSQL or SQLite). The data is clearly structured, with students, courses and enrolments that have well-defined relationships, and the system needs rules the database itself should enforce, such as unique emails and no double enrolment. SQL handles many-to-many relationships and queries like "students on a course" or "students with no enrolments" naturally using JOINs. A document database would store this data in nested documents, which makes it harder to keep consistent when the same course appears in many students' records.
