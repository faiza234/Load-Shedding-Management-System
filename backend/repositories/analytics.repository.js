// repositories/analytics.repository.js
const pool = require("../db/pool");

class AnalyticsRepository {
  // -------------------------------------------------------------------------
  // MONTHLY ANALYSIS CRUD
  // -------------------------------------------------------------------------
  async getMonthlyAnalysis({ area_id, year, month } = {}) {
    let sql = `
      SELECT m.*, a.area_name, a.division, a.region_type
      FROM monthly_analysis m
      JOIN area a ON a.area_id = m.area_id
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

    sql += " ORDER BY m.year DESC, m.month DESC, a.division, a.area_name";

    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    });
  }

  async getMonthlyAnalysisById(analysisId) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(
        `SELECT m.*, a.area_name, a.division, a.region_type
         FROM monthly_analysis m
         JOIN area a ON a.area_id = m.area_id
         WHERE m.analysis_id = ?`,
        [analysisId]
      );
      return rows[0] || null;
    });
  }

  async createMonthlyAnalysis(data) {
    const {
      area_id,
      month,
      year,
      outage_percentage,
      avg_daily_hours,
      total_outages,
      improvement_status = "stable",
    } = data;

    return pool.executeWithRetry(async () => {
      const [result] = await pool.execute(
        `INSERT INTO monthly_analysis
          (area_id, month, year, outage_percentage, avg_daily_hours, total_outages, improvement_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          area_id,
          month,
          year,
          outage_percentage,
          avg_daily_hours,
          total_outages,
          improvement_status,
        ]
      );
      return this.getMonthlyAnalysisById(result.insertId);
    });
  }

  async updateMonthlyAnalysis(analysisId, data) {
    return pool.executeWithRetry(async () => {
      const existing = await this.getMonthlyAnalysisById(analysisId);
      if (!existing) return null;

      const merged = {
        area_id: data.area_id ?? existing.area_id,
        month: data.month ?? existing.month,
        year: data.year ?? existing.year,
        outage_percentage: data.outage_percentage ?? existing.outage_percentage,
        avg_daily_hours: data.avg_daily_hours ?? existing.avg_daily_hours,
        total_outages: data.total_outages ?? existing.total_outages,
        improvement_status: data.improvement_status ?? existing.improvement_status,
      };

      await pool.execute(
        `UPDATE monthly_analysis
         SET area_id = ?, month = ?, year = ?, outage_percentage = ?,
             avg_daily_hours = ?, total_outages = ?, improvement_status = ?
         WHERE analysis_id = ?`,
        [
          merged.area_id,
          merged.month,
          merged.year,
          merged.outage_percentage,
          merged.avg_daily_hours,
          merged.total_outages,
          merged.improvement_status,
          analysisId,
        ]
      );

      return this.getMonthlyAnalysisById(analysisId);
    });
  }

  async deleteMonthlyAnalysis(analysisId) {
    return pool.executeWithRetry(async () => {
      const [result] = await pool.execute(
        "DELETE FROM monthly_analysis WHERE analysis_id = ?",
        [analysisId]
      );
      return result.affectedRows > 0;
    });
  }

  // -------------------------------------------------------------------------
  // HIGH RISK ZONE CRUD
  // -------------------------------------------------------------------------
  async getHighRiskZones({ year, month, all } = {}) {
    return pool.executeWithRetry(async () => {
      if (!all && !year && !month) {
        const [rows] = await pool.query(`
          SELECT * FROM v_high_risk_current
          ORDER BY FIELD(risk_level, 'Critical', 'High', 'Medium', 'Low'), area_name
        `);
        return rows;
      }

      let sql = `
        SELECT h.*, a.area_name, a.division, a.region_type
        FROM high_risk_zone h
        JOIN area a ON a.area_id = h.area_id
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

      sql += " ORDER BY h.year DESC, h.month DESC, FIELD(h.risk_level, 'Critical', 'High', 'Medium', 'Low'), a.area_name";
      const [rows] = await pool.execute(sql, params);
      return rows;
    });
  }

  async getHighRiskZoneById(zoneId) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(
        `SELECT h.*, a.area_name, a.division, a.region_type
         FROM high_risk_zone h
         JOIN area a ON a.area_id = h.area_id
         WHERE h.zone_id = ?`,
        [zoneId]
      );
      return rows[0] || null;
    });
  }

  async createHighRiskZone({ area_id, month, year, risk_level, flagged_reason, flagged_date }) {
    const now = new Date();
    const m = Number(month) || now.getMonth() + 1;
    const y = Number(year) || now.getFullYear();
    const date = flagged_date || now.toISOString().slice(0, 10);

    return pool.executeWithRetry(async () => {
      const [result] = await pool.execute(
        `INSERT INTO high_risk_zone
          (area_id, month, year, risk_level, flagged_reason, flagged_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [area_id, m, y, risk_level, flagged_reason || null, date]
      );
      return this.getHighRiskZoneById(result.insertId);
    });
  }

  async updateHighRiskZone(zoneId, data) {
    return pool.executeWithRetry(async () => {
      const existing = await this.getHighRiskZoneById(zoneId);
      if (!existing) return null;

      const merged = {
        area_id: data.area_id ?? existing.area_id,
        month: data.month ?? existing.month,
        year: data.year ?? existing.year,
        risk_level: data.risk_level ?? existing.risk_level,
        flagged_reason:
          data.flagged_reason !== undefined ? data.flagged_reason : existing.flagged_reason,
        flagged_date:
          data.flagged_date !== undefined ? data.flagged_date : existing.flagged_date,
      };

      await pool.execute(
        `UPDATE high_risk_zone
         SET area_id = ?, month = ?, year = ?, risk_level = ?,
             flagged_reason = ?, flagged_date = ?
         WHERE zone_id = ?`,
        [
          merged.area_id,
          merged.month,
          merged.year,
          merged.risk_level,
          merged.flagged_reason,
          merged.flagged_date,
          zoneId,
        ]
      );
      return this.getHighRiskZoneById(zoneId);
    });
  }

  async deleteHighRiskZone(zoneId) {
    return pool.executeWithRetry(async () => {
      const [result] = await pool.execute("DELETE FROM high_risk_zone WHERE zone_id = ?", [zoneId]);
      return result.affectedRows > 0;
    });
  }

  // -------------------------------------------------------------------------
  // DAILY FREQUENCY CRUD
  // -------------------------------------------------------------------------
  async getDailyFrequency({ area_id, days, date, all } = {}) {
    let sql = `
      SELECT f.*, a.area_name, a.division, a.region_type
      FROM daily_frequency f
      JOIN area a ON a.area_id = f.area_id
      WHERE 1=1`;
    const params = [];

    if (!all && !date) {
      const limit = Number(days) || 30;
      sql += " AND f.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
      params.push(limit);
    }
    if (date) {
      sql += " AND f.date = ?";
      params.push(date);
    }
    if (area_id) {
      sql += " AND f.area_id = ?";
      params.push(area_id);
    }

    sql += " ORDER BY f.date DESC, a.division, a.area_name";

    return pool.executeWithRetry(async () => {
      const [rows] = await pool.query(sql, params);
      return rows;
    });
  }

  async getDailyFrequencyById(frequencyId) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(
        `SELECT f.*, a.area_name, a.division, a.region_type
         FROM daily_frequency f
         JOIN area a ON a.area_id = f.area_id
         WHERE f.frequency_id = ?`,
        [frequencyId]
      );
      return rows[0] || null;
    });
  }

  async createDailyFrequency({ area_id, date, outage_count, total_outage_hours }) {
    const count = Number(outage_count);
    const hours = Number(total_outage_hours);
    const average = count > 0 ? Number((hours / count).toFixed(2)) : 0;

    return pool.executeWithRetry(async () => {
      const [result] = await pool.execute(
        `INSERT INTO daily_frequency
          (area_id, date, outage_count, total_outage_hours, avg_outage_duration)
         VALUES (?, ?, ?, ?, ?)`,
        [area_id, date, count, hours, average]
      );
      return this.getDailyFrequencyById(result.insertId);
    });
  }

  async updateDailyFrequency(frequencyId, data) {
    return pool.executeWithRetry(async () => {
      const existing = await this.getDailyFrequencyById(frequencyId);
      if (!existing) return null;

      const areaId = data.area_id ?? existing.area_id;
      const recordDate = data.date ?? existing.date;
      const count = Number(data.outage_count ?? existing.outage_count);
      const hours = Number(data.total_outage_hours ?? existing.total_outage_hours);
      const average = count > 0 ? Number((hours / count).toFixed(2)) : 0;

      await pool.execute(
        `UPDATE daily_frequency
         SET area_id = ?, date = ?, outage_count = ?, total_outage_hours = ?, avg_outage_duration = ?
         WHERE frequency_id = ?`,
        [areaId, recordDate, count, hours, average, frequencyId]
      );
      return this.getDailyFrequencyById(frequencyId);
    });
  }

  async deleteDailyFrequency(frequencyId) {
    return pool.executeWithRetry(async () => {
      const [result] = await pool.execute("DELETE FROM daily_frequency WHERE frequency_id = ?", [frequencyId]);
      return result.affectedRows > 0;
    });
  }

  // -------------------------------------------------------------------------
  // OVERVIEW METRICS
  // -------------------------------------------------------------------------
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
        pool.query("SELECT COUNT(*) AS n FROM outage_schedule WHERE TIMESTAMP(schedule_date, start_time) >= NOW()"),
        pool.query(`
          SELECT COUNT(*) AS n FROM high_risk_zone
          WHERE (year, month) = (
            SELECT year, month FROM high_risk_zone ORDER BY year DESC, month DESC LIMIT 1
          )
        `),
        pool.query(`
          SELECT ROUND(AVG(outage_percentage), 1) AS avg FROM monthly_analysis
          WHERE (year, month) = (
            SELECT year, month FROM monthly_analysis ORDER BY year DESC, month DESC LIMIT 1
          )
        `),
        pool.query(`
          SELECT a.division, ROUND(AVG(m.outage_percentage), 1) AS avg_outage_percentage
          FROM monthly_analysis m
          JOIN area a ON a.area_id = m.area_id
          WHERE (m.year, m.month) = (
            SELECT year, month FROM monthly_analysis ORDER BY year DESC, month DESC LIMIT 1
          )
          GROUP BY a.division
          ORDER BY avg_outage_percentage DESC
        `),
        pool.query(`
          SELECT area_name, division, total_complaints AS complaint_count
          FROM v_area_complaint_summary
          ORDER BY total_complaints DESC
          LIMIT 5
        `),
      ]);

      return {
        totalAreas,
        totalDistricts: totalAreas,
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