CREATE DATABASE IF NOT EXISTS campustime;
USE campustime;

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('teacher', 'admin') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teachers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  department VARCHAR(120) NOT NULL,
  qualifications JSON NOT NULL,
  can_handle_labs BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE courses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE academic_years (
  id INT PRIMARY KEY AUTO_INCREMENT,
  course_id INT NOT NULL,
  name VARCHAR(40) NOT NULL,
  CONSTRAINT fk_academic_years_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT uq_academic_year_per_course UNIQUE (course_id, name)
);

CREATE TABLE sections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  academic_year_id INT NOT NULL,
  name VARCHAR(40) NOT NULL,
  CONSTRAINT fk_sections_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  CONSTRAINT uq_section_per_year UNIQUE (academic_year_id, name)
);

CREATE TABLE batches (
  id INT PRIMARY KEY AUTO_INCREMENT,
  section_id INT NOT NULL,
  name VARCHAR(60) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_batches_section FOREIGN KEY (section_id) REFERENCES sections(id),
  CONSTRAINT uq_batch_per_section UNIQUE (section_id, name)
);

CREATE TABLE subjects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  course_id INT NOT NULL,
  CONSTRAINT fk_subjects_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT uq_subject_per_course UNIQUE (course_id, name)
);

CREATE TABLE teacher_subjects (
  teacher_id INT NOT NULL,
  subject_id INT NOT NULL,
  PRIMARY KEY (teacher_id, subject_id),
  CONSTRAINT fk_teacher_subjects_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  CONSTRAINT fk_teacher_subjects_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

CREATE TABLE rooms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE,
  type ENUM('room', 'lab') NOT NULL
);

CREATE TABLE timetable_slots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  academic_year_id INT NOT NULL,
  section_id INT NOT NULL,
  batch_id INT NULL,
  subject_id INT NOT NULL,
  teacher_id INT NOT NULL,
  day ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_id INT NOT NULL,
  session_type ENUM('Lecture', 'Practical', 'Seminar', 'VET', 'Internship', 'Other') NOT NULL,
  status ENUM('Draft', 'Scheduled', 'Current', 'Upcoming', 'Completed', 'Changed', 'Substitute', 'Room Changed', 'Cancelled') NOT NULL DEFAULT 'Draft',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_slots_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  CONSTRAINT fk_slots_section FOREIGN KEY (section_id) REFERENCES sections(id),
  CONSTRAINT fk_slots_batch FOREIGN KEY (batch_id) REFERENCES batches(id),
  CONSTRAINT fk_slots_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT fk_slots_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  CONSTRAINT fk_slots_room FOREIGN KEY (room_id) REFERENCES rooms(id),
  CONSTRAINT ck_time_order CHECK (start_time < end_time),
  CONSTRAINT ck_batch_for_practical CHECK (
    (session_type = 'Practical' AND batch_id IS NOT NULL)
    OR (session_type <> 'Practical')
  )
);

CREATE TABLE attendance_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  teacher_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('Present', 'Absent', 'Late', 'On Leave') NOT NULL,
  source VARCHAR(80) NOT NULL,
  synced_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  CONSTRAINT uq_attendance_teacher_date UNIQUE (teacher_id, date)
);

CREATE TABLE substitution_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  timetable_slot_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('Open', 'Pending Approval', 'Approved', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_substitution_requests_slot FOREIGN KEY (timetable_slot_id) REFERENCES timetable_slots(id),
  CONSTRAINT uq_substitution_request_slot_date UNIQUE (timetable_slot_id, date)
);

CREATE TABLE substitution_candidates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id INT NOT NULL,
  teacher_id INT NOT NULL,
  score INT NOT NULL,
  reasons_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_candidates_request FOREIGN KEY (request_id) REFERENCES substitution_requests(id),
  CONSTRAINT fk_candidates_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  CONSTRAINT uq_candidate_per_request UNIQUE (request_id, teacher_id)
);

CREATE TABLE substitution_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id INT NOT NULL,
  teacher_id INT NOT NULL,
  assigned_by INT NOT NULL,
  status ENUM('Pending Approval', 'Assigned', 'Accepted', 'Review Requested', 'Rejected') NOT NULL DEFAULT 'Pending Approval',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignments_request FOREIGN KEY (request_id) REFERENCES substitution_requests(id),
  CONSTRAINT fk_assignments_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  CONSTRAINT fk_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id)
);

CREATE TABLE timetable_changes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  slot_id INT NOT NULL,
  change_type ENUM('Substitute', 'Room Changed', 'Cancelled', 'Rescheduled', 'Edited') NOT NULL,
  old_value JSON NULL,
  new_value JSON NOT NULL,
  published_at TIMESTAMP NULL,
  CONSTRAINT fk_changes_slot FOREIGN KEY (slot_id) REFERENCES timetable_slots(id)
);

CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type VARCHAR(80) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  role ENUM('teacher', 'admin') NOT NULL,
  action VARCHAR(120) NOT NULL,
  entity VARCHAR(120) NOT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_public_timetable ON timetable_slots (is_published, academic_year_id, section_id, batch_id, day, start_time);
CREATE INDEX idx_teacher_slot_time ON timetable_slots (teacher_id, day, start_time, end_time);
CREATE INDEX idx_attendance_date ON attendance_records (date, status);
