-- =============================================================================
-- Load Shedding Management System — Example Queries
-- =============================================================================
-- Run schema.sql and populate the database (via `npm run seed`) first.
-- These queries aren't required by the app — they're here so you can run and
-- show them directly in MySQL Workbench for your lab presentation/report.
-- They demonstrate: joins, aggregation, subqueries, views, and the stored
-- procedure/trigger defined in schema.sql.
-- =============================================================================
USE load_shedding_db;

-- -----------------------------------------------------------------------------
-- 1. Simple JOIN: list every open complaint with citizen + area details.
-- -----------------------------------------------------------------------------
SELECT co.complaint_id, c.full_name, c.phone, a.area_name, a.division,
       co.description, co.reported_at
FROM complaint co
JOIN citizen c ON c.citizen_id = co.citizen_id
JOIN area a ON a.area_id = co.area_id
WHERE co.status = 'open'
ORDER BY co.reported_at DESC;

-- -----------------------------------------------------------------------------
-- 2. Aggregation + GROUP BY: average outage % by division for the most
--    recent month present in monthly_analysis.
-- -----------------------------------------------------------------------------
SELECT a.division,
       ROUND(AVG(m.outage_percentage), 2) AS avg_outage_pct,
       COUNT(*) AS districts_counted
FROM monthly_analysis m
JOIN area a ON a.area_id = m.area_id
WHERE (m.year, m.month) = (
  SELECT year, month FROM monthly_analysis ORDER BY year DESC, month DESC LIMIT 1
)
GROUP BY a.division
ORDER BY avg_outage_pct DESC;

-- -----------------------------------------------------------------------------
-- 3. Subquery in WHERE: districts whose current outage % is above the
--    national average for the same month.
-- -----------------------------------------------------------------------------
SELECT a.area_name, a.division, m.outage_percentage
FROM monthly_analysis m
JOIN area a ON a.area_id = m.area_id
WHERE (m.year, m.month) = (SELECT year, month FROM monthly_analysis ORDER BY year DESC, month DESC LIMIT 1)
  AND m.outage_percentage > (
    SELECT AVG(outage_percentage) FROM monthly_analysis m2
    WHERE (m2.year, m2.month) = (m.year, m.month)
  )
ORDER BY m.outage_percentage DESC;

-- -----------------------------------------------------------------------------
-- 4. Multi-table JOIN with GROUP BY + HAVING: districts with 3+ complaints
--    that are still unresolved.
-- -----------------------------------------------------------------------------
SELECT a.area_name, a.division, COUNT(*) AS open_complaint_count
FROM complaint co
JOIN area a ON a.area_id = co.area_id
WHERE co.status IN ('open', 'in_review')
GROUP BY a.area_id, a.area_name, a.division
HAVING COUNT(*) >= 3
ORDER BY open_complaint_count DESC;

-- -----------------------------------------------------------------------------
-- 5. Correlated subquery: for each district, the date of its longest single
--    outage window in the last 30 days.
-- -----------------------------------------------------------------------------
SELECT a.area_name,
       (SELECT df.date FROM daily_frequency df
        WHERE df.area_id = a.area_id
        ORDER BY df.total_outage_hours DESC LIMIT 1) AS worst_day,
       (SELECT MAX(df.total_outage_hours) FROM daily_frequency df
        WHERE df.area_id = a.area_id) AS worst_day_hours
FROM area a
ORDER BY worst_day_hours DESC
LIMIT 10;

-- -----------------------------------------------------------------------------
-- 6. Using a VIEW: currently flagged high-risk zones (view already joins
--    high_risk_zone + area and filters to the latest month).
-- -----------------------------------------------------------------------------
SELECT * FROM v_high_risk_current
ORDER BY FIELD(risk_level, 'Critical', 'High', 'Medium', 'Low');

-- -----------------------------------------------------------------------------
-- 7. Using a VIEW: complaint totals per district, broken down by status.
-- -----------------------------------------------------------------------------
SELECT * FROM v_area_complaint_summary
ORDER BY total_complaints DESC
LIMIT 10;

-- -----------------------------------------------------------------------------
-- 8. Calling the STORED PROCEDURE: full report for one district (change the
--    area_id to look at a different one — 1 is Dhaka).
-- -----------------------------------------------------------------------------
CALL sp_area_report(1);

-- -----------------------------------------------------------------------------
-- 9. Trigger in action: insert a row into daily_frequency with a wrong
--    avg_outage_duration on purpose — the trg_daily_frequency_avg trigger
--    recalculates it automatically before the row is saved.
-- -----------------------------------------------------------------------------
INSERT INTO daily_frequency (area_id, date, outage_count, total_outage_hours, avg_outage_duration)
VALUES (1, '2020-01-01', 4, 8.0, 999.0);  -- 999.0 is intentionally wrong

SELECT * FROM daily_frequency WHERE area_id = 1 AND date = '2020-01-01';
-- avg_outage_duration comes back as 2.00 (8.0 / 4), not 999 - the trigger fixed it.

-- clean up the demo row
DELETE FROM daily_frequency WHERE area_id = 1 AND date = '2020-01-01';

-- -----------------------------------------------------------------------------
-- 10. Ranking with a window function: rank districts by this month's outage %
--     within their own division.
-- -----------------------------------------------------------------------------
SELECT a.division, a.area_name, m.outage_percentage,
       RANK() OVER (PARTITION BY a.division ORDER BY m.outage_percentage DESC) AS rank_in_division
FROM monthly_analysis m
JOIN area a ON a.area_id = m.area_id
WHERE (m.year, m.month) = (SELECT year, month FROM monthly_analysis ORDER BY year DESC, month DESC LIMIT 1)
ORDER BY a.division, rank_in_division;

-- -----------------------------------------------------------------------------
-- 11. Normalized M:N Relationship: list each authority user and all assigned
--     areas managed by them via authority_user_area.
-- -----------------------------------------------------------------------------
SELECT u.user_id, u.user_name, u.role, a.area_id, a.area_name, a.division, aua.assigned_at
FROM authority_user u
JOIN authority_user_area aua ON aua.user_id = u.user_id
JOIN area a ON a.area_id = aua.area_id
ORDER BY u.user_name, a.area_name;

-- -----------------------------------------------------------------------------
-- 12. 1:M Relationship: list complaints along with all authority actions taken
--     in response to each complaint.
-- -----------------------------------------------------------------------------
SELECT c.complaint_id, c.description AS complaint_desc, c.status,
       act.action_id, act.action_type, act.notes AS action_notes, act.action_time,
       u.user_name AS officer_name
FROM complaint c
JOIN authority_action act ON act.complaint_id = c.complaint_id
JOIN authority_user u ON u.user_id = act.user_id
ORDER BY c.complaint_id, act.action_time DESC;

