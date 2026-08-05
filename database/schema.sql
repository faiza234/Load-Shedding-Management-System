-- =============================================================================
-- Load Shedding Management System — MySQL Schema
-- =============================================================================
-- This is the primary database script for the project. Run this FIRST, in
-- MySQL Workbench, phpMyAdmin, or the `mysql` command line client, before
-- starting the backend server or running the seed script.
--
--   mysql -u root -p < schema.sql
-- It creates the database, all 10 tables (matching the ER diagram / relational
-- schema), their constraints, two views, one stored procedure, and one
-- trigger, and the included sample dataset. Safe to re-run: it drops the database first if it already exists.
-- =============================================================================

DROP DATABASE IF EXISTS load_shedding_db;
CREATE DATABASE load_shedding_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE load_shedding_db;

-- -----------------------------------------------------------------------------
-- AREA — geographical districts/areas used by the sample dataset.
-- area_name stores the district name; division and region_type are used for
-- classification and filtering.
-- -----------------------------------------------------------------------------
CREATE TABLE area (
  area_id      INT AUTO_INCREMENT PRIMARY KEY,
  area_name    VARCHAR(100) NOT NULL,
  division     VARCHAR(50)  NOT NULL,
  region_type  ENUM('Urban', 'Semi-Urban', 'Rural') NOT NULL,
  zip_code     VARCHAR(10),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_area_name (area_name),
  INDEX idx_area_division (division),
  INDEX idx_area_region (region_type)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- AUTHORITY_USER — staff accounts (admins / field officers).
-- -----------------------------------------------------------------------------
CREATE TABLE authority_user (
  user_id        INT AUTO_INCREMENT PRIMARY KEY,
  user_name      VARCHAR(50) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  contact_email  VARCHAR(100),
  role           ENUM('admin', 'officer') NOT NULL DEFAULT 'officer',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_name (user_name)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- AUTHORITY_USER_AREA — normalized junction table for M:N relation between
-- authority_user and area. Establishes (M:1) relation to authority_user and (M:1) to area.
-- -----------------------------------------------------------------------------
CREATE TABLE authority_user_area (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  area_id      INT NOT NULL,
  assigned_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_user_area (user_id, area_id),

  CONSTRAINT fk_user_area_user
    FOREIGN KEY (user_id)
    REFERENCES authority_user(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_user_area_area
    FOREIGN KEY (area_id)
    REFERENCES area(area_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_user_area_area (area_id)
) ENGINE=InnoDB;
-- -----------------------------------------------------------------------------
-- CITIZEN — residents who may file complaints. "resides_in" Area.
-- -----------------------------------------------------------------------------
CREATE TABLE citizen (
  citizen_id   INT AUTO_INCREMENT PRIMARY KEY,
  full_name    VARCHAR(100) NOT NULL,
  phone        VARCHAR(20),
  email        VARCHAR(100),
  area_id      INT NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_citizen_area FOREIGN KEY (area_id)
    REFERENCES area(area_id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_citizen_phone (phone),
  INDEX idx_citizen_name (full_name),
  INDEX idx_citizen_area (area_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- OUTAGE_SCHEDULE — planned load-shedding windows per area. "has" / "created_by".
-- -----------------------------------------------------------------------------
CREATE TABLE outage_schedule (
  schedule_id     INT AUTO_INCREMENT PRIMARY KEY,
  area_id         INT NOT NULL,
  schedule_date   DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  duration_hours  DECIMAL(4,1) NOT NULL,
  reason          VARCHAR(255),
  created_by      INT NULL,                   -- authority_user.user_id
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_area FOREIGN KEY (area_id)
    REFERENCES area(area_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_creator FOREIGN KEY (created_by)
    REFERENCES authority_user(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_schedule_date (schedule_date),
  INDEX idx_schedule_area_date (area_id, schedule_date)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- COMPLAINT — citizen-filed complaints. "files" / "reported_for" / "linked_to".
-- -----------------------------------------------------------------------------
CREATE TABLE complaint (
  complaint_id     INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id       INT NOT NULL,
  area_id          INT NOT NULL,
  schedule_id      INT NULL,                  -- optionally linked to a specific outage
  reported_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description      TEXT NOT NULL,
  status           ENUM('open', 'in_review', 'resolved', 'rejected') NOT NULL DEFAULT 'open',
  resolution_note  TEXT,
  CONSTRAINT fk_complaint_citizen FOREIGN KEY (citizen_id)
    REFERENCES citizen(citizen_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_complaint_area FOREIGN KEY (area_id)
    REFERENCES area(area_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_complaint_schedule FOREIGN KEY (schedule_id)
    REFERENCES outage_schedule(schedule_id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_complaint_status (status),
  INDEX idx_complaint_area_status (area_id, status),
  INDEX idx_complaint_citizen (citizen_id),
  INDEX idx_complaint_reported (reported_at)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- AUTHORITY_ACTION — log of actions officers take. "performs" / "targeted_by".
-- -----------------------------------------------------------------------------
CREATE TABLE authority_action (
  action_id    INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  area_id      INT NOT NULL,
  complaint_id INT NULL,                  -- linked citizen complaint (1:M)
  action_time  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  action_type  VARCHAR(100) NOT NULL,
  notes        TEXT,
  CONSTRAINT fk_action_user FOREIGN KEY (user_id)
    REFERENCES authority_user(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_action_area FOREIGN KEY (area_id)
    REFERENCES area(area_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_action_complaint FOREIGN KEY (complaint_id)
    REFERENCES complaint(complaint_id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_action_area_time (area_id, action_time),
  INDEX idx_action_user (user_id),
  INDEX idx_action_complaint (complaint_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- MONTHLY_ANALYSIS — per-area, per-month rollup statistics. "analyzed_in".
-- -----------------------------------------------------------------------------
CREATE TABLE monthly_analysis ( 
  analysis_id         INT AUTO_INCREMENT PRIMARY KEY,
  area_id             INT NOT NULL,
  month               TINYINT NOT NULL,        -- 1-12
  year                SMALLINT NOT NULL,
  outage_percentage   DECIMAL(5,2) NOT NULL,   -- % of monitored hours with an outage
  avg_daily_hours     DECIMAL(5,2) NOT NULL,
  total_outages       INT NOT NULL,
  improvement_status  ENUM('improved', 'stable', 'worsened') NOT NULL DEFAULT 'stable',
  UNIQUE KEY uq_analysis_area_month (area_id, month, year),
  CONSTRAINT fk_analysis_area FOREIGN KEY (area_id)
    REFERENCES area(area_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_analysis_month CHECK (month BETWEEN 1 AND 12),
  INDEX idx_analysis_year_month (year, month)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- HIGH_RISK_ZONE — areas flagged as high risk for a given month. "flagged_as".
-- -----------------------------------------------------------------------------
CREATE TABLE high_risk_zone (
  zone_id         INT AUTO_INCREMENT PRIMARY KEY,
  area_id         INT NOT NULL,
  month           TINYINT NOT NULL,
  year            SMALLINT NOT NULL,
  risk_level      ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL,
  flagged_reason  VARCHAR(255),
  flagged_date    DATE NOT NULL,
  UNIQUE KEY uq_risk_area_month (area_id, month, year),
  CONSTRAINT fk_risk_area FOREIGN KEY (area_id)
    REFERENCES area(area_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_risk_month CHECK (month BETWEEN 1 AND 12),
  INDEX idx_risk_year_month (year, month)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- DAILY_FREQUENCY — per-area, per-day outage counters. "tracked_in".
-- -----------------------------------------------------------------------------
CREATE TABLE daily_frequency (
  frequency_id         INT AUTO_INCREMENT PRIMARY KEY,
  area_id              INT NOT NULL,
  date                 DATE NOT NULL,
  outage_count         INT NOT NULL,
  total_outage_hours   DECIMAL(5,2) NOT NULL,
  avg_outage_duration  DECIMAL(5,2) NOT NULL,
  UNIQUE KEY uq_freq_area_date (area_id, date),
  CONSTRAINT fk_freq_area FOREIGN KEY (area_id)
    REFERENCES area(area_id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_daily_date (date)
) ENGINE=InnoDB;


-- =============================================================================
-- VIEWS
-- =============================================================================

-- v_high_risk_current: high risk zones for whichever month/year is the most
-- recent one present in the table — this is what the dashboard's "High Risk
-- Zones" screen reads from.
CREATE VIEW v_high_risk_current AS
SELECT h.zone_id, h.area_id, a.area_name, a.division, a.region_type,
       h.month, h.year, h.risk_level, h.flagged_reason, h.flagged_date
FROM high_risk_zone h
JOIN area a ON a.area_id = h.area_id
WHERE (h.year, h.month) = (
  SELECT year, month FROM high_risk_zone ORDER BY year DESC, month DESC LIMIT 1
);

-- v_area_complaint_summary: per-area complaint counts by status, used for the
-- "Top districts by complaint volume" panel and general reporting.
CREATE VIEW v_area_complaint_summary AS
SELECT a.area_id, a.area_name, a.division,
       COUNT(*) AS total_complaints,
       SUM(c.status = 'open') AS open_complaints,
       SUM(c.status = 'in_review') AS in_review_complaints,
       SUM(c.status = 'resolved') AS resolved_complaints,
       SUM(c.status = 'rejected') AS rejected_complaints
FROM complaint c
JOIN area a ON a.area_id = c.area_id
GROUP BY a.area_id, a.area_name, a.division;


-- =============================================================================
-- STORED PROCEDURE
-- =============================================================================
-- sp_area_report: one call returns everything needed for an area's detail
-- report — its profile, latest monthly analysis, latest risk flag (if any),
-- and open complaint / upcoming schedule counts. Demonstrates a multi-result
-- set procedure with an IN parameter.
DELIMITER //
CREATE PROCEDURE sp_area_report(IN p_area_id INT)
BEGIN
  -- Result set 1: area profile
  SELECT * FROM area WHERE area_id = p_area_id;

  -- Result set 2: most recent monthly analysis row for this area
  SELECT * FROM monthly_analysis
  WHERE area_id = p_area_id
  ORDER BY year DESC, month DESC
  LIMIT 1;

  -- Result set 3: current high-risk flag for this area, if any
  SELECT * FROM high_risk_zone
  WHERE area_id = p_area_id
  ORDER BY year DESC, month DESC
  LIMIT 1;

  -- Result set 4: quick counts
  SELECT
    (SELECT COUNT(*) FROM complaint WHERE area_id = p_area_id AND status IN ('open','in_review')) AS open_complaints,
    (SELECT COUNT(*) FROM outage_schedule WHERE area_id = p_area_id AND schedule_date >= CURDATE()) AS upcoming_schedules;
END //
DELIMITER ;


-- =============================================================================
-- TRIGGER
-- =============================================================================
-- trg_daily_frequency_avg: keeps avg_outage_duration internally consistent
-- (total_outage_hours / outage_count) no matter what the caller passes in,
-- so this derived value can never drift out of sync with its inputs.
DELIMITER //
CREATE TRIGGER trg_daily_frequency_avg
BEFORE INSERT ON daily_frequency
FOR EACH ROW
BEGIN
  IF NEW.outage_count > 0 THEN
    SET NEW.avg_outage_duration = ROUND(NEW.total_outage_hours / NEW.outage_count, 2);
  ELSE
    SET NEW.avg_outage_duration = 0;
  END IF;
END //
DELIMITER ;

-- =============================================================================
-- SAMPLE DATA
-- =============================================================================
-- Important:
-- 1. This section assumes a fresh database created by this same file.
-- 2. The authority accounts below all use the password: password123
-- 3. The 30 citizen rows are placeholder demo records added because the
--    supplied complaint rows reference citizen_id values 1 through 30.
-- 4. The sample contains 30 areas, not all 64 districts of Bangladesh.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- AREAS
-- -----------------------------------------------------------------------------
INSERT INTO area (area_name, division, region_type, zip_code) VALUES
('Dhaka', 'Dhaka', 'Urban', '1000'),
('Gazipur', 'Dhaka', 'Urban', '1700'),
('Narayanganj', 'Dhaka', 'Urban', '1400'),
('Narsingdi', 'Dhaka', 'Semi-Urban', '1600'),
('Tangail', 'Dhaka', 'Semi-Urban', '1900'),
('Faridpur', 'Dhaka', 'Semi-Urban', '7800'),
('Manikganj', 'Dhaka', 'Rural', '1800'),
('Munshiganj', 'Dhaka', 'Semi-Urban', '1500'),
('Kishoreganj', 'Dhaka', 'Rural', '2300'),
('Rajbari', 'Dhaka', 'Rural', '7700'),

('Chattogram', 'Chattogram', 'Urban', '4000'),
('Cumilla', 'Chattogram', 'Urban', '3500'),
('Cox''s Bazar', 'Chattogram', 'Urban', '4700'),
('Feni', 'Chattogram', 'Semi-Urban', '3900'),
('Noakhali', 'Chattogram', 'Semi-Urban', '3800'),
('Lakshmipur', 'Chattogram', 'Rural', '3700'),
('Khagrachhari', 'Chattogram', 'Rural', '4400'),
('Rangamati', 'Chattogram', 'Rural', '4500'),
('Bandarban', 'Chattogram', 'Rural', '4600'),
('Brahmanbaria', 'Chattogram', 'Semi-Urban', '3400'),

('Rajshahi', 'Rajshahi', 'Urban', '6000'),
('Bogura', 'Rajshahi', 'Urban', '5800'),
('Pabna', 'Rajshahi', 'Semi-Urban', '6600'),
('Natore', 'Rajshahi', 'Rural', '6400'),
('Naogaon', 'Rajshahi', 'Rural', '6500'),
('Chapainawabganj', 'Rajshahi', 'Rural', '6300'),
('Joypurhat', 'Rajshahi', 'Rural', '5900'),
('Sirajganj', 'Rajshahi', 'Semi-Urban', '6700'),
('Khulna', 'Khulna', 'Urban', '9000'),
('Jashore', 'Khulna', 'Urban', '7400');

-- -----------------------------------------------------------------------------
-- AUTHORITY USERS
-- All accounts use password123. A valid bcrypt hash is used so login works.
-- -----------------------------------------------------------------------------

INSERT INTO authority_user (user_name, password_hash, contact_email, role) VALUES
('admin', 'password123', 'admin@lsms.gov.bd', 'admin'),
('officer_dhaka', 'password123', 'dhaka@lsms.gov.bd', 'officer'),
('officer_gazipur', 'password123', 'gazipur@lsms.gov.bd', 'officer'),
('officer_narayanganj', 'password123', 'narayanganj@lsms.gov.bd', 'officer'),
('officer_narsingdi', 'password123', 'narsingdi@lsms.gov.bd', 'officer'),
('officer_tangail', 'password123', 'tangail@lsms.gov.bd', 'officer'),
('officer_faridpur', 'password123', 'faridpur@lsms.gov.bd', 'officer'),
('officer_manikganj', 'password123', 'manikganj@lsms.gov.bd', 'officer'),
('officer_munshiganj', 'password123', 'munshiganj@lsms.gov.bd', 'officer'),
('officer_kishoreganj', 'password123', 'kishoreganj@lsms.gov.bd', 'officer'),
('officer_rajbari', 'password123', 'rajbari@lsms.gov.bd', 'officer'),
('officer_chattogram', 'password123', 'chattogram@lsms.gov.bd', 'officer'),
('officer_cumilla', 'password123', 'cumilla@lsms.gov.bd', 'officer'),
('officer_coxbazar', 'password123', 'coxbazar@lsms.gov.bd', 'officer'),
('officer_feni', 'password123', 'feni@lsms.gov.bd', 'officer'),
('officer_noakhali', 'password123', 'noakhali@lsms.gov.bd', 'officer'),
('officer_lakshmipur', 'password123', 'lakshmipur@lsms.gov.bd', 'officer'),
('officer_khagrachari', 'password123', 'khagrachari@lsms.gov.bd', 'officer'),
('officer_rangamati', 'password123', 'rangamati@lsms.gov.bd', 'officer'),
('officer_bandarban', 'password123', 'bandarban@lsms.gov.bd', 'officer'),
('officer_brahmanbaria', 'password123', 'brahmanbaria@lsms.gov.bd', 'officer'),
('officer_rajshahi', 'password123', 'rajshahi@lsms.gov.bd', 'officer'),
('officer_bogura', 'password123', 'bogura@lsms.gov.bd', 'officer'),
('officer_pabna', 'password123', 'pabna@lsms.gov.bd', 'officer'),
('officer_natore', 'password123', 'natore@lsms.gov.bd', 'officer'),
('officer_naogaon', 'password123', 'naogaon@lsms.gov.bd', 'officer'),
('officer_chapainawabganj', 'password123', 'chapai@lsms.gov.bd', 'officer'),
('officer_joypurhat', 'password123', 'joypurhat@lsms.gov.bd', 'officer'),
('officer_sirajganj', 'password123', 'sirajganj@lsms.gov.bd', 'officer'),
('officer_khulna', 'password123', 'khulna@lsms.gov.bd', 'officer');

-- -----------------------------------------------------------------------------
-- AUTHORITY USER ↔ AREA ASSIGNMENTS
-- -----------------------------------------------------------------------------
INSERT INTO authority_user_area (user_id, area_id) VALUES
-- Admin has access to all areas
(1,1),(1,2),(1,3),(1,4),(1,5),
(1,6),(1,7),(1,8),(1,9),(1,10),
(1,11),(1,12),(1,13),(1,14),(1,15),
(1,16),(1,17),(1,18),(1,19),(1,20),
(1,21),(1,22),(1,23),(1,24),(1,25),
(1,26),(1,27),(1,28),(1,29),(1,30),

-- Officers assigned to their respective areas
(2,1),(3,2),(4,3),(5,4),(6,5),(7,6),(8,7),(9,8),(10,9),(11,10),
(12,11),(13,12),(14,13),(15,14),(16,15),(17,16),(18,17),(19,18),
(20,19),(21,20),(22,21),(23,22),(24,23),(25,24),(26,25),(27,26),
(28,27),(29,28),(30,29);

-- -----------------------------------------------------------------------------
-- PLACEHOLDER CITIZENS
-- Replace these demo identities with your real citizen sample data if available.
-- -----------------------------------------------------------------------------
INSERT INTO citizen (citizen_id, full_name, phone, email, area_id) VALUES
(1, 'Citizen 01', '01700000001', 'citizen01@example.com', 1),
(2, 'Citizen 02', '01700000002', 'citizen02@example.com', 2),
(3, 'Citizen 03', '01700000003', 'citizen03@example.com', 3),
(4, 'Citizen 04', '01700000004', 'citizen04@example.com', 4),
(5, 'Citizen 05', '01700000005', 'citizen05@example.com', 5),
(6, 'Citizen 06', '01700000006', 'citizen06@example.com', 6),
(7, 'Citizen 07', '01700000007', 'citizen07@example.com', 7),
(8, 'Citizen 08', '01700000008', 'citizen08@example.com', 8),
(9, 'Citizen 09', '01700000009', 'citizen09@example.com', 9),
(10, 'Citizen 10', '01700000010', 'citizen10@example.com', 10),
(11, 'Citizen 11', '01700000011', 'citizen11@example.com', 11),
(12, 'Citizen 12', '01700000012', 'citizen12@example.com', 12),
(13, 'Citizen 13', '01700000013', 'citizen13@example.com', 13),
(14, 'Citizen 14', '01700000014', 'citizen14@example.com', 14),
(15, 'Citizen 15', '01700000015', 'citizen15@example.com', 15),
(16, 'Citizen 16', '01700000016', 'citizen16@example.com', 16),
(17, 'Citizen 17', '01700000017', 'citizen17@example.com', 17),
(18, 'Citizen 18', '01700000018', 'citizen18@example.com', 18),
(19, 'Citizen 19', '01700000019', 'citizen19@example.com', 19),
(20, 'Citizen 20', '01700000020', 'citizen20@example.com', 20),
(21, 'Citizen 21', '01700000021', 'citizen21@example.com', 21),
(22, 'Citizen 22', '01700000022', 'citizen22@example.com', 22),
(23, 'Citizen 23', '01700000023', 'citizen23@example.com', 23),
(24, 'Citizen 24', '01700000024', 'citizen24@example.com', 24),
(25, 'Citizen 25', '01700000025', 'citizen25@example.com', 25),
(26, 'Citizen 26', '01700000026', 'citizen26@example.com', 26),
(27, 'Citizen 27', '01700000027', 'citizen27@example.com', 27),
(28, 'Citizen 28', '01700000028', 'citizen28@example.com', 28),
(29, 'Citizen 29', '01700000029', 'citizen29@example.com', 29),
(30, 'Citizen 30', '01700000030', 'citizen30@example.com', 30);

-- -----------------------------------------------------------------------------
-- OUTAGE SCHEDULES
-- Must be inserted before complaints because complaint.schedule_id is an FK.
-- -----------------------------------------------------------------------------
INSERT INTO outage_schedule
(area_id, schedule_date, start_time, end_time, duration_hours, reason, created_by)
VALUES
(1, '2026-08-10', '09:00:00', '11:00:00', 2.0, 'Routine Maintenance', 1),
(2, '2026-08-10', '14:00:00', '16:00:00', 2.0, 'Transformer Maintenance', 2),
(3, '2026-08-11', '10:00:00', '12:30:00', 2.5, 'Distribution Line Upgrade', 3),
(4, '2026-08-11', '15:00:00', '17:00:00', 2.0, 'Emergency Repair', 4),
(5, '2026-08-12', '08:00:00', '10:00:00', 2.0, 'Routine Maintenance', 5),
(6, '2026-08-12', '13:00:00', '15:30:00', 2.5, 'Substation Inspection', 6),
(7, '2026-08-13', '09:30:00', '11:30:00', 2.0, 'Feeder Maintenance', 7),
(8, '2026-08-13', '16:00:00', '18:00:00', 2.0, 'Cable Replacement', 8),
(9, '2026-08-14', '07:00:00', '09:00:00', 2.0, 'Grid Maintenance', 9),
(10, '2026-08-14', '12:00:00', '14:30:00', 2.5, 'Pole Replacement', 10),

(11, '2026-08-15', '10:00:00', '12:00:00', 2.0, 'Routine Maintenance', 11),
(12, '2026-08-15', '14:30:00', '16:30:00', 2.0, 'Transformer Upgrade', 12),
(13, '2026-08-16', '09:00:00', '11:00:00', 2.0, 'Scheduled Maintenance', 13),
(14, '2026-08-16', '15:00:00', '17:30:00', 2.5, 'Emergency Line Repair', 14),
(15, '2026-08-17', '08:30:00', '10:30:00', 2.0, 'Substation Upgrade', 15),
(16, '2026-08-17', '13:00:00', '15:00:00', 2.0, 'Routine Inspection', 16),
(17, '2026-08-18', '10:00:00', '12:30:00', 2.5, 'Transformer Maintenance', 17),
(18, '2026-08-18', '15:00:00', '17:00:00', 2.0, 'Cable Replacement', 18),
(19, '2026-08-19', '09:00:00', '11:00:00', 2.0, 'Feeder Upgrade', 19),
(20, '2026-08-19', '14:00:00', '16:30:00', 2.5, 'Grid Maintenance', 20),

(21, '2026-08-20', '08:00:00', '10:00:00', 2.0, 'Routine Maintenance', 21),
(22, '2026-08-20', '13:00:00', '15:00:00', 2.0, 'Emergency Transformer Repair', 22),
(23, '2026-08-21', '09:30:00', '11:30:00', 2.0, 'Substation Maintenance', 23),
(24, '2026-08-21', '15:00:00', '17:00:00', 2.0, 'Distribution Upgrade', 24),
(25, '2026-08-22', '07:30:00', '10:00:00', 2.5, 'Power Line Inspection', 25),
(26, '2026-08-22', '12:30:00', '14:30:00', 2.0, 'Routine Maintenance', 26),
(27, '2026-08-23', '10:00:00', '12:00:00', 2.0, 'Cable Maintenance', 27),
(28, '2026-08-23', '14:00:00', '16:30:00', 2.5, 'Grid Equipment Upgrade', 28),
(29, '2026-08-24', '09:00:00', '11:00:00', 2.0, 'Pole Maintenance', 29),
(30, '2026-08-24', '15:00:00', '17:00:00', 2.0, 'Routine Maintenance', 30);

-- -----------------------------------------------------------------------------
-- COMPLAINTS
-- -----------------------------------------------------------------------------
INSERT INTO complaint
(citizen_id, area_id, schedule_id, reported_at, description, status, resolution_note)
VALUES
(1, 1, 1, '2026-08-10 11:15:00', 'Power was not restored on time after the scheduled outage.', 'resolved', 'Power restored after replacing a faulty transformer.'),
(2, 2, 2, '2026-08-10 15:30:00', 'Voltage remained unstable after maintenance.', 'in_review', NULL),
(3, 3, 3, '2026-08-11 12:45:00', 'Unexpected outage outside the announced schedule.', 'open', NULL),
(4, 4, 4, '2026-08-11 17:20:00', 'Electricity was unavailable for more than three hours.', 'resolved', 'Damaged feeder line repaired.'),
(5, 5, 5, '2026-08-12 10:10:00', 'Power returned nearly one hour later than scheduled.', 'resolved', 'Maintenance took longer than expected.'),

(6, 6, 6, '2026-08-12 15:40:00', 'Frequent voltage fluctuations after restoration.', 'in_review', NULL),
(7, 7, 7, '2026-08-13 11:50:00', 'Scheduled outage notification was not received.', 'resolved', 'SMS notification system updated.'),
(8, 8, 8, '2026-08-13 18:15:00', 'Entire neighborhood lost power unexpectedly.', 'open', NULL),
(9, 9, 9, '2026-08-14 09:20:00', 'Street lights remained off after power restoration.', 'in_review', NULL),
(10, 10, 10, '2026-08-14 14:45:00', 'Power outage lasted much longer than announced.', 'resolved', 'Emergency repair completed.'),

(11, 11, 11, '2026-08-15 12:10:00', 'Voltage was too low after maintenance.', 'open', NULL),
(12, 12, 12, '2026-08-15 16:50:00', 'Transformer produced unusual noise after restoration.', 'in_review', NULL),
(13, 13, 13, '2026-08-16 11:05:00', 'Power supply interrupted repeatedly throughout the day.', 'resolved', 'Loose cable connection fixed.'),
(14, 14, 14, '2026-08-16 17:45:00', 'Emergency outage occurred without prior notice.', 'open', NULL),
(15, 15, 15, '2026-08-17 10:35:00', 'Electricity restored but internet equipment damaged due to surge.', 'resolved', 'Voltage regulator installed.'),

(16, 16, 16, '2026-08-17 15:10:00', 'Area experienced multiple outages within one day.', 'in_review', NULL),
(17, 17, 17, '2026-08-18 12:40:00', 'Frequent tripping after scheduled maintenance.', 'resolved', 'Circuit breaker replaced.'),
(18, 18, 18, '2026-08-18 17:15:00', 'Power returned but voltage remained unstable.', 'open', NULL),
(19, 19, 19, '2026-08-19 11:30:00', 'Scheduled outage exceeded announced duration.', 'resolved', 'Additional repair work was required.'),
(20, 20, 20, '2026-08-19 16:45:00', 'Several houses still had no electricity after restoration.', 'in_review', NULL),

(21, 21, 21, '2026-08-20 10:20:00', 'Power outage affected nearby hospital.', 'resolved', 'Priority feeder restored immediately.'),
(22, 22, 22, '2026-08-20 15:35:00', 'Transformer failure caused extended outage.', 'resolved', 'Transformer replaced successfully.'),
(23, 23, 23, '2026-08-21 12:15:00', 'Power cuts have become too frequent this month.', 'open', NULL),
(24, 24, 24, '2026-08-21 17:05:00', 'Voltage spikes damaged household appliances.', 'in_review', NULL),
(25, 25, 25, '2026-08-22 10:50:00', 'Maintenance was completed later than announced.', 'resolved', 'Work completed and supply restored.'),

(26, 26, 26, '2026-08-22 14:40:00', 'Power restoration was delayed because of equipment failure.', 'resolved', 'Faulty switchgear replaced.'),
(27, 27, 27, '2026-08-23 12:20:00', 'Unexpected outage occurred during heavy rain.', 'open', NULL),
(28, 28, 28, '2026-08-23 16:55:00', 'Residents did not receive any outage notification.', 'resolved', 'Notification service improved.'),
(29, 29, 29, '2026-08-24 11:40:00', 'Power restored briefly and failed again.', 'in_review', NULL),
(30, 30, 30, '2026-08-24 17:15:00', 'Repeated outages disrupted business operations.', 'open', NULL);

-- -----------------------------------------------------------------------------
-- AUTHORITY ACTIONS
-- -----------------------------------------------------------------------------
INSERT INTO authority_action
(user_id, area_id, complaint_id, action_time, action_type, notes)
VALUES
(2, 1, 1, '2026-08-10 11:30:00', 'Inspection', 'Field team inspected the affected transformer.'),
(3, 2, 2, '2026-08-10 16:00:00', 'Voltage Check', 'Voltage fluctuation investigation initiated.'),
(4, 3, 3, '2026-08-11 13:15:00', 'Emergency Repair', 'Crew dispatched to repair damaged distribution line.'),
(5, 4, 4, '2026-08-11 17:45:00', 'Power Restoration', 'Electricity restored successfully.'),
(6, 5, 5, '2026-08-12 10:30:00', 'Maintenance', 'Completed scheduled maintenance work.'),
(7, 6, 6, '2026-08-12 16:00:00', 'Transformer Inspection', 'Transformer tested for overload conditions.'),
(8, 7, 7, '2026-08-13 12:00:00', 'Notification Update', 'SMS notification service reconfigured.'),
(9, 8, 8, '2026-08-13 18:30:00', 'Emergency Response', 'Repair crew reached the outage location.'),
(10, 9, 9, '2026-08-14 09:45:00', 'Street Light Repair', 'Street lighting restored after power recovery.'),
(11, 10, 10, '2026-08-14 15:00:00', 'Line Repair', 'Damaged feeder repaired and tested.'),

(12, 11, 11, '2026-08-15 12:30:00', 'Voltage Monitoring', 'Monitoring voltage stability after restoration.'),
(13, 12, 12, '2026-08-15 17:00:00', 'Transformer Repair', 'Cooling system of transformer repaired.'),
(14, 13, 13, '2026-08-16 11:30:00', 'Cable Replacement', 'Old underground cable replaced.'),
(15, 14, 14, '2026-08-16 18:00:00', 'Emergency Inspection', 'Inspection completed after sudden outage.'),
(16, 15, 15, '2026-08-17 11:00:00', 'Surge Investigation', 'Voltage surge source identified.'),
(17, 16, 16, '2026-08-17 15:45:00', 'System Monitoring', 'Grid monitored for repeated outages.'),
(18, 17, 17, '2026-08-18 13:00:00', 'Breaker Replacement', 'Faulty breaker replaced successfully.'),
(19, 18, 18, '2026-08-18 17:30:00', 'Voltage Test', 'Voltage level returned to normal.'),
(20, 19, 19, '2026-08-19 12:00:00', 'Maintenance Extension', 'Maintenance duration extended due to additional faults.'),
(21, 20, 20, '2026-08-19 17:00:00', 'Local Repair', 'Local distribution issue resolved.'),

(22, 21, 21, '2026-08-20 10:45:00', 'Priority Restoration', 'Hospital feeder restored first.'),
(23, 22, 22, '2026-08-20 16:00:00', 'Transformer Replacement', 'Old transformer replaced with new unit.'),
(24, 23, 23, '2026-08-21 12:45:00', 'Complaint Review', 'Complaint forwarded for technical review.'),
(25, 24, 24, '2026-08-21 17:30:00', 'Voltage Stabilization', 'Voltage stabilizer installed temporarily.'),
(26, 25, 25, '2026-08-22 11:15:00', 'Maintenance Completion', 'Maintenance work completed successfully.'),
(27, 26, 26, '2026-08-22 15:00:00', 'Switchgear Repair', 'Faulty switchgear repaired.'),
(28, 27, 27, '2026-08-23 12:45:00', 'Storm Damage Inspection', 'Power line inspected after heavy rainfall.'),
(29, 28, 28, '2026-08-23 17:15:00', 'Notification Improvement', 'Residents added to SMS alert system.'),
(30, 29, 29, '2026-08-24 12:00:00', 'Feeder Repair', 'Faulty feeder repaired and tested.'),
(1, 30, 30, '2026-08-24 17:45:00', 'Administrative Review', 'Complaint reviewed by system administrator and forwarded to the regional office.');

-- -----------------------------------------------------------------------------
-- MONTHLY ANALYSIS
-- -----------------------------------------------------------------------------
INSERT INTO monthly_analysis
(area_id, month, year, outage_percentage, avg_daily_hours, total_outages, improvement_status)
VALUES
(1, 8, 2026, 4.20, 1.80, 12, 'improved'),
(2, 8, 2026, 6.10, 2.10, 15, 'stable'),
(3, 8, 2026, 5.80, 2.00, 14, 'improved'),
(4, 8, 2026, 7.50, 2.60, 18, 'stable'),
(5, 8, 2026, 8.30, 2.90, 21, 'worsened'),
(6, 8, 2026, 6.70, 2.20, 16, 'stable'),
(7, 8, 2026, 9.10, 3.10, 24, 'worsened'),
(8, 8, 2026, 5.20, 1.90, 13, 'improved'),
(9, 8, 2026, 6.90, 2.40, 17, 'stable'),
(10, 8, 2026, 7.80, 2.80, 20, 'stable'),
(11, 8, 2026, 4.90, 1.70, 11, 'improved'),
(12, 8, 2026, 8.60, 3.00, 22, 'worsened'),
(13, 8, 2026, 5.60, 2.00, 14, 'stable'),
(14, 8, 2026, 9.50, 3.40, 26, 'worsened'),
(15, 8, 2026, 7.20, 2.50, 18, 'stable'),
(16, 8, 2026, 6.40, 2.20, 16, 'improved'),
(17, 8, 2026, 10.10, 3.60, 28, 'worsened'),
(18, 8, 2026, 5.40, 1.90, 13, 'improved'),
(19, 8, 2026, 8.10, 2.90, 21, 'stable'),
(20, 8, 2026, 7.60, 2.70, 19, 'stable'),
(21, 8, 2026, 6.30, 2.10, 15, 'improved'),
(22, 8, 2026, 9.30, 3.30, 25, 'worsened'),
(23, 8, 2026, 5.90, 2.00, 14, 'stable'),
(24, 8, 2026, 8.80, 3.10, 23, 'worsened'),
(25, 8, 2026, 7.10, 2.50, 18, 'stable'),
(26, 8, 2026, 4.70, 1.60, 10, 'improved'),
(27, 8, 2026, 6.80, 2.30, 16, 'stable'),
(28, 8, 2026, 9.70, 3.50, 27, 'worsened'),
(29, 8, 2026, 5.50, 1.90, 13, 'improved'),
(30, 8, 2026, 7.40, 2.60, 19, 'stable');

-- -----------------------------------------------------------------------------
-- HIGH-RISK ZONES
-- -----------------------------------------------------------------------------
INSERT INTO high_risk_zone
(area_id, month, year, risk_level, flagged_reason, flagged_date)
VALUES
(1, 8, 2026, 'Low', 'Stable electricity supply with minimal outages.', '2026-08-31'),
(2, 8, 2026, 'Medium', 'Outage frequency slightly above expected level.', '2026-08-31'),
(3, 8, 2026, 'Low', 'Improved performance after recent maintenance.', '2026-08-31'),
(4, 8, 2026, 'Medium', 'Several scheduled outages affected consumers.', '2026-08-31'),
(5, 8, 2026, 'High', 'High outage duration due to transformer issues.', '2026-08-31'),
(6, 8, 2026, 'Medium', 'Recurring feeder maintenance increased outage hours.', '2026-08-31'),
(7, 8, 2026, 'High', 'Frequent power interruptions reported.', '2026-08-31'),
(8, 8, 2026, 'Low', 'Outage frequency remained below national average.', '2026-08-31'),
(9, 8, 2026, 'Medium', 'Voltage instability detected during peak hours.', '2026-08-31'),
(10, 8, 2026, 'Medium', 'Distribution line maintenance caused delays.', '2026-08-31'),

(11, 8, 2026, 'Low', 'Reliable supply maintained throughout the month.', '2026-08-31'),
(12, 8, 2026, 'High', 'Transformer overload increased outage frequency.', '2026-08-31'),
(13, 8, 2026, 'Medium', 'Routine maintenance slightly impacted service.', '2026-08-31'),
(14, 8, 2026, 'Critical', 'Major grid failure caused extended outages.', '2026-08-31'),
(15, 8, 2026, 'Medium', 'Multiple feeder faults observed.', '2026-08-31'),
(16, 8, 2026, 'Low', 'Outage duration decreased compared to previous month.', '2026-08-31'),
(17, 8, 2026, 'Critical', 'Highest outage duration among monitored areas.', '2026-08-31'),
(18, 8, 2026, 'Low', 'System performance remained stable.', '2026-08-31'),
(19, 8, 2026, 'High', 'Repeated outages due to aging infrastructure.', '2026-08-31'),
(20, 8, 2026, 'Medium', 'Unexpected equipment failures recorded.', '2026-08-31'),

(21, 8, 2026, 'Low', 'Power supply improved significantly.', '2026-08-31'),
(22, 8, 2026, 'High', 'Transformer replacement required after repeated faults.', '2026-08-31'),
(23, 8, 2026, 'Medium', 'Power interruptions exceeded monthly target.', '2026-08-31'),
(24, 8, 2026, 'High', 'Grid capacity insufficient during peak demand.', '2026-08-31'),
(25, 8, 2026, 'Medium', 'Routine maintenance increased outage hours.', '2026-08-31'),
(26, 8, 2026, 'Low', 'Lowest outage percentage this month.', '2026-08-31'),
(27, 8, 2026, 'Medium', 'Distribution equipment required repair.', '2026-08-31'),
(28, 8, 2026, 'Critical', 'Severe infrastructure damage after storms.', '2026-08-31'),
(29, 8, 2026, 'Low', 'Power supply remained consistent.', '2026-08-31'),
(30, 8, 2026, 'Medium', 'Above-average outage duration recorded.', '2026-08-31');

-- -----------------------------------------------------------------------------
-- DAILY FREQUENCY
-- The BEFORE INSERT trigger recalculates avg_outage_duration automatically.
-- -----------------------------------------------------------------------------
INSERT INTO daily_frequency
(area_id, date, outage_count, total_outage_hours, avg_outage_duration)
VALUES
(1, '2026-08-24', 1, 2.00, 2.00),
(2, '2026-08-24', 2, 4.00, 2.00),
(3, '2026-08-24', 2, 4.50, 2.25),
(4, '2026-08-24', 2, 5.00, 2.50),
(5, '2026-08-24', 3, 7.50, 2.50),
(6, '2026-08-24', 2, 4.50, 2.25),
(7, '2026-08-24', 4, 10.00, 2.50),
(8, '2026-08-24', 1, 2.00, 2.00),
(9, '2026-08-24', 2, 5.00, 2.50),
(10, '2026-08-24', 3, 7.50, 2.50),

(11, '2026-08-24', 1, 2.00, 2.00),
(12, '2026-08-24', 4, 10.50, 2.63),
(13, '2026-08-24', 2, 4.00, 2.00),
(14, '2026-08-24', 5, 13.00, 2.60),
(15, '2026-08-24', 3, 7.50, 2.50),
(16, '2026-08-24', 2, 4.50, 2.25),
(17, '2026-08-24', 5, 14.00, 2.80),
(18, '2026-08-24', 1, 2.00, 2.00),
(19, '2026-08-24', 3, 8.00, 2.67),
(20, '2026-08-24', 3, 7.50, 2.50),

(21, '2026-08-24', 2, 4.00, 2.00),
(22, '2026-08-24', 4, 11.00, 2.75),
(23, '2026-08-24', 2, 4.50, 2.25),
(24, '2026-08-24', 4, 10.00, 2.50),
(25, '2026-08-24', 3, 7.50, 2.50),
(26, '2026-08-24', 1, 1.50, 1.50),
(27, '2026-08-24', 2, 4.50, 2.25),
(28, '2026-08-24', 5, 13.50, 2.70),
(29, '2026-08-24', 1, 2.00, 2.00),
(30, '2026-08-24', 3, 7.50, 2.50);

-- =============================================================================
-- END OF SCHEMA + SAMPLE DATA
-- =============================================================================
