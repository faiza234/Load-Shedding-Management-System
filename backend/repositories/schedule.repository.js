// repositories/schedule.repository.js
const pool = require("../db/pool");

class ScheduleRepository {
  async findAll({ area_id, from, to } = {}) {
    let sql = `
      SELECT s.*, a.area_name, a.division, u.user_name AS created_by_name
      FROM outage_schedule s
      JOIN area a ON a.area_id = s.area_id
      LEFT JOIN authority_user u ON u.user_id = s.created_by
      WHERE 1=1`;
    const params = [];
    if (area_id) {
      sql += " AND s.area_id = ?";
      params.push(area_id);
    }
    if (from) {
      sql += " AND s.schedule_date >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND s.schedule_date <= ?";
      params.push(to);
    }
    sql += " ORDER BY s.schedule_date DESC, s.start_time";

    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    });
  }

  async findById(id) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(
        `SELECT s.*, a.area_name, a.division, u.user_name AS created_by_name
         FROM outage_schedule s
         JOIN area a ON a.area_id = s.area_id
         LEFT JOIN authority_user u ON u.user_id = s.created_by
         WHERE s.schedule_id = ?`,
        [id]
      );
      return rows[0] || null;
    });
  }

  async create({ area_id, schedule_date, start_time, end_time, duration_hours, reason, created_by }) {
    return pool.executeWithRetry(async () => {
      const [result] = await pool.execute(
        `INSERT INTO outage_schedule (area_id, schedule_date, start_time, end_time, duration_hours, reason, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [area_id, schedule_date, start_time, end_time, duration_hours, reason || null, created_by || null]
      );
      return this.findById(result.insertId);
    });
  }

  async update(id, scheduleData) {
    return pool.executeWithRetry(async () => {
      const existing = await this.findById(id);
      if (!existing) return null;

      const merged = {
        area_id: scheduleData.area_id ?? existing.area_id,
        schedule_date: scheduleData.schedule_date ?? existing.schedule_date,
        start_time: scheduleData.start_time ?? existing.start_time,
        end_time: scheduleData.end_time ?? existing.end_time,
        duration_hours: scheduleData.duration_hours ?? existing.duration_hours,
        reason: scheduleData.reason !== undefined ? scheduleData.reason : existing.reason,
      };

      await pool.execute(
        `UPDATE outage_schedule
         SET area_id = ?, schedule_date = ?, start_time = ?, end_time = ?, duration_hours = ?, reason = ?
         WHERE schedule_id = ?`,
        [
          merged.area_id,
          merged.schedule_date,
          merged.start_time,
          merged.end_time,
          merged.duration_hours,
          merged.reason,
          id,
        ]
      );

      return this.findById(id);
    });
  }

  async delete(id) {
    return pool.executeWithRetry(async () => {
      const existing = await this.findById(id);
      if (!existing) return false;
      await pool.execute("DELETE FROM outage_schedule WHERE schedule_id = ?", [id]);
      return true;
    });
  }
}

module.exports = new ScheduleRepository();
