// repositories/analytics.repository.js
const pool = require("../db/pool");

class AnalyticsRepository {
  async getMonthlyAnalysis({ area_id, year, month } = {}) {
    let sql = `
      SELECT m.*, a.area_name, a.division, a.region_type
      FROM monthly_analysis m JOIN area a ON a.area_id = m.area_id
      WHERE 1=1`;
    const params = [];
    if (area_id) {
      sql += " AND m.area_id = ?";
      params.push(area_id);
    }
    if (year) {
      sql += " AND m.year = ?";
      params.push(year);
    }
    if (month) {
      sql += " AND m.month = ?";
      params.push(month);
    }
    sql += " ORDER BY m.year, m.month";

    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    });
  }

  async getHighRiskZones({ year, month } = {}) {
    return pool.executeWithRetry(async () => {
      if (!year && !month) {
        const [rows] = await pool.query(`
          SELECT * FROM v_high_risk_current
          ORDER BY FIELD(risk_level, 'Critical', 'High', 'Medium', 'Low')
        `);
        return rows;
      }

      let sql = `
        SELECT h.*, a.area_name, a.division, a.region_type
        FROM high_risk_zone h JOIN area a ON a.area_id = h.area_id
        WHERE 1=1`;
      const params = [];
      if (year) {
        sql += " AND h.year = ?";
        params.push(year);
      }
      if (month) {
        sql += " AND h.month = ?";
        params.push(month);
      }
      sql += " ORDER BY FIELD(h.risk_level, 'Critical', 'High', 'Medium', 'Low')";

      const [rows] = await pool.execute(sql, params);
      return rows;
    });
  }

  async getHighRiskZoneById(zoneId) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(
        `SELECT h.*, a.area_name, a.division, a.region_type
         FROM high_risk_zone h JOIN area a ON a.area_id = h.area_id
         WHERE h.zone_id = ?`,
        [zoneId]
      );
      return rows[0] || null;
    });
  }

  async createHighRiskZone({ area_id, month, year, risk_level, flagged_reason, flagged_date }) {
    const now = new Date();
    const m = Number(month) || (now.getMonth() + 1);
    const y = Number(year) || now.getFullYear();
    const todayStr = flagged_date || now.toISOString().slice(0, 10);
    const areaId = Number(area_id);

    return pool.executeWithRetry(async () => {
      await pool.execute(
        `INSERT INTO high_risk_zone (area_id, month, year, risk_level, flagged_reason, flagged_date)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE risk_level = VALUES(risk_level), flagged_reason = VALUES(flagged_reason), flagged_date = VALUES(flagged_date)`,
        [areaId, m, y, risk_level, flagged_reason || null, todayStr]
      );

      const [rows] = await pool.execute(
        "SELECT zone_id FROM high_risk_zone WHERE area_id = ? AND month = ? AND year = ?",
        [areaId, m, y]
      );
      if (!rows[0]) return null;
      return this.getHighRiskZoneById(rows[0].zone_id);
    });
  }

  async updateHighRiskZone(zoneId, { risk_level, flagged_reason }) {
    return pool.executeWithRetry(async () => {
      const existing = await this.getHighRiskZoneById(zoneId);
      if (!existing) return null;

      const newLevel = risk_level ?? existing.risk_level;
      const newReason = flagged_reason !== undefined ? flagged_reason : existing.flagged_reason;

      await pool.execute(
        "UPDATE high_risk_zone SET risk_level = ?, flagged_reason = ? WHERE zone_id = ?",
        [newLevel, newReason, zoneId]
      );
      return this.getHighRiskZoneById(zoneId);
    });
  }

  async deleteHighRiskZone(zoneId) {
    return pool.executeWithRetry(async () => {
      const existing = await this.getHighRiskZoneById(zoneId);
      if (!existing) return false;
      await pool.execute("DELETE FROM high_risk_zone WHERE zone_id = ?", [zoneId]);
      return true;
    });
  }

  async getDailyFrequency({ area_id, days = 30 } = {}) {
    const limit = Number(days) || 30;
    let sql = `
      SELECT f.*, a.area_name, a.division
      FROM daily_frequency f JOIN area a ON a.area_id = f.area_id
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`;
    const params = [limit];
    if (area_id) {
      sql += " AND f.area_id = ?";
      params.push(area_id);
    }
    sql += " ORDER BY f.date";

    return pool.executeWithRetry(async () => {
      const [rows] = await pool.query(sql, params);
      return rows;
    });
  }

  /**
   * Optimized batch query to eliminate N+1 latency bottlenecks for dashboard summary metrics
   */
  async getSummaryMetrics() {
    return pool.executeWithRetry(async () => {
      const [
        [[{ n: totalAreas }]],
        [[{ n: openComplaints }]],
        [[{ n: upcomingSchedules }]],
        [[{ n: highRiskCount }]],
        [[{ avg: avgOutagePctRaw }]],
        [byDivision],
        [topComplaintAreas],
      ] = await Promise.all([
        pool.query("SELECT COUNT(*) AS n FROM area"),
        pool.query("SELECT COUNT(*) AS n FROM complaint WHERE status IN ('open','in_review')"),
        pool.query("SELECT COUNT(*) AS n FROM outage_schedule WHERE schedule_date >= CURDATE()"),
        pool.query(`
          SELECT COUNT(*) AS n FROM high_risk_zone
          WHERE (year, month) = (SELECT year, month FROM high_risk_zone ORDER BY year DESC, month DESC LIMIT 1)
        `),
        pool.query(`
          SELECT ROUND(AVG(outage_percentage), 1) AS avg FROM monthly_analysis
          WHERE (year, month) = (SELECT year, month FROM monthly_analysis ORDER BY year DESC, month DESC LIMIT 1)
        `),
        pool.query(`
          SELECT a.division, ROUND(AVG(m.outage_percentage), 1) AS avg_outage_percentage
          FROM monthly_analysis m JOIN area a ON a.area_id = m.area_id
          WHERE (m.year, m.month) = (SELECT year, month FROM monthly_analysis ORDER BY year DESC, month DESC LIMIT 1)
          GROUP BY a.division ORDER BY avg_outage_percentage DESC
        `),
        pool.query(`
          SELECT area_name, division, total_complaints AS complaint_count
          FROM v_area_complaint_summary
          ORDER BY total_complaints DESC LIMIT 5
        `),
      ]);

      return {
        totalAreas,
        openComplaints,
        upcomingSchedules,
        highRiskCount,
        avgOutagePct: avgOutagePctRaw === null ? 0 : Number(avgOutagePctRaw),
        byDivision,
        topComplaintAreas,
      };
    });
  }
}

module.exports = new AnalyticsRepository();
