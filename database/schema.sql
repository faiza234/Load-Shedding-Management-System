-- =============================================================================
-- Load Shedding Management System — MySQL Schema
-- =============================================================================
-- This is the primary database script for the project. Run this FIRST, in
-- MySQL Workbench, phpMyAdmin, or the `mysql` command line client, before
-- starting the backend server or running the seed script.
--
--   mysql -u root -p < schema.sql
--
-- It creates the database, all 10 tables (matching the ER diagram / relational
-- schema), their constraints, two views, one stored procedure, and one
-- trigger. Safe to re-run: it drops the database first if it already exists.
-- =============================================================================

DROP DATABASE IF EXISTS load_shedding_db;
CREATE DATABASE load_shedding_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE load_shedding_db;

-- -----------------------------------------------------------------------------
-- AREA  — the 64 districts of Bangladesh.
-- area_name stores the DISTRICT NAME. division + region_type together are
-- used for classification/filtering (per project convention).
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
  user_id      INT NOT NULL,
  area_id      INT NOT NULL,
  assigned_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, area_id),
  CONSTRAINT fk_user_area_user FOREIGN KEY (user_id)
    REFERENCES authority_user(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_area_area FOREIGN KEY (area_id)
    REFERENCES area(area_id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_user_area_user (user_id),
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
