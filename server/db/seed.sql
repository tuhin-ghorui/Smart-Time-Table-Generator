USE campustime;

INSERT INTO courses (id, name) VALUES (1, 'BCA')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO academic_years (id, course_id, name) VALUES
  (1, 1, 'FY'),
  (2, 1, 'SY'),
  (3, 1, 'TY')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO sections (id, academic_year_id, name) VALUES
  (1, 2, 'A'),
  (2, 2, 'B')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO batches (id, section_id, name, is_active) VALUES
  (1, 1, 'Batch 1', TRUE),
  (2, 1, 'Batch 2', TRUE),
  (3, 1, 'Batch 3', FALSE)
ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = VALUES(is_active);

INSERT INTO subjects (id, name, course_id) VALUES
  (1, 'Database Management', 1),
  (2, 'Web Development Lab', 1),
  (3, 'Python', 1),
  (4, 'Software Engineering', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO rooms (id, name, type) VALUES
  (1, 'A-204', 'room'),
  (2, 'Lab-2', 'lab'),
  (3, 'B-105', 'room')
ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type);
