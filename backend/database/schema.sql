-- CampusTime - Smart College Timetable & Faculty Substitution System
-- MySQL schema (import in MySQL Workbench or run `npm run db:schema`)

CREATE DATABASE IF NOT EXISTS campustime
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campustime;

-- ---------- Users & faculty ----------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('teacher','admin') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  department VARCHAR(100),
  qualifications TEXT,
  CONSTRAINT fk_teacher_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- Academic structure (dynamic) ----------
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_years (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  name VARCHAR(20) NOT NULL,
  CONSTRAINT fk_year_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academic_year_id INT NOT NULL,
  name VARCHAR(10) NOT NULL,
  CONSTRAINT fk_section_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  name VARCHAR(20) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_batch_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  UNIQUE KEY uq_batch_section (section_id, name)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  course_id INT NOT NULL,
  CONSTRAINT fk_subject_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  type ENUM('room','lab') NOT NULL
);

-- ---------- Timetable ----------
CREATE TABLE IF NOT EXISTS timetable_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academic_year_id INT NOT NULL,
  section_id INT NOT NULL,
  batch_id INT NULL,
  subject_id INT NOT NULL,
  teacher_id INT NOT NULL,
  day VARCHAR(10) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_id INT NOT NULL,
  session_type VARCHAR(20) NOT NULL DEFAULT 'Lecture',
  status VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_slot_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  CONSTRAINT fk_slot_section FOREIGN KEY (section_id) REFERENCES sections(id),
  CONSTRAINT fk_slot_batch FOREIGN KEY (batch_id) REFERENCES batches(id),
  CONSTRAINT fk_slot_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT fk_slot_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  CONSTRAINT fk_slot_room FOREIGN KEY (room_id) REFERENCES rooms(id),
  INDEX idx_slot_day (day),
  INDEX idx_slot_teacher (teacher_id)
);

-- ---------- Attendance ----------
CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('present','absent','leave') NOT NULL,
  reason VARCHAR(255) NULL,
  source VARCHAR(50) DEFAULT 'manual',
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance (teacher_id, date),
  CONSTRAINT fk_att_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- ---------- Substitution workflow ----------
CREATE TABLE IF NOT EXISTS substitution_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  timetable_slot_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('open','filled','rejected','cancelled') NOT NULL DEFAULT 'open',
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_req_slot FOREIGN KEY (timetable_slot_id) REFERENCES timetable_slots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS substitution_candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  teacher_id INT NOT NULL,
  score INT NOT NULL,
  reasons_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cand_request FOREIGN KEY (request_id) REFERENCES substitution_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_cand_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS substitution_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  teacher_id INT NOT NULL,
  assigned_by INT NOT NULL,
  status ENUM('pending','accepted','declined','review','cancelled') NOT NULL DEFAULT 'pending',
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assign_request FOREIGN KEY (request_id) REFERENCES substitution_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_assign_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  CONSTRAINT fk_assign_by FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- ---------- Change history ----------
CREATE TABLE IF NOT EXISTS timetable_changes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slot_id INT NOT NULL,
  change_type ENUM('substitute','room_changed','cancelled','rescheduled','created','updated','published') NOT NULL,
  old_value TEXT,
  new_value TEXT,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_by INT NULL,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_change_slot FOREIGN KEY (slot_id) REFERENCES timetable_slots(id) ON DELETE CASCADE,
  CONSTRAINT fk_change_user FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50),
  message TEXT NOT NULL,
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- Audit log ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  role VARCHAR(20),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
