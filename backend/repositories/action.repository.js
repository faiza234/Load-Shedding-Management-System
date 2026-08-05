// repositories/action.repository.js
const pool = require("../db/pool");

class ActionRepository {
  async findAll({ area_id, complaint_id, action_type, search } = {}) {
    let sql = `
      SELECT ac.*, u.user_name, a.area_name, a.division,
             co.description AS complaint_description, c.full_name AS citizen_name
      FROM authority_action ac
      JOIN authority_user u ON u.user_id = ac.user_id
      JOIN area a ON a.area_id = ac.area_id
      LEFT JOIN complaint co ON co.complaint_id = ac.complaint_id
      LEFT JOIN citizen c ON c.citizen_id = co.citizen_id
      WHERE 1=1`;
    const params = [];

    if (area_id) {
      sql += " AND ac.area_id = ?";
      params.push(area_id);
    }
    if (complaint_id) {
      sql += " AND ac.complaint_id = ?";
      params.push(complaint_id);
    }
    if (action_type) {
      sql += " AND ac.action_type = ?";
      params.push(action_type);
    }
    if (search) {
      sql += " AND (ac.notes LIKE ? OR ac.action_type LIKE ? OR a.area_name LIKE ? OR u.user_name LIKE ?)";
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    sql += " ORDER BY ac.action_time DESC, ac.action_id DESC";

    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    });
  }

  async findById(id) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(
        `SELECT ac.*, u.user_name, a.area_name, a.division,
                co.description AS complaint_description, c.full_name AS citizen_name
         FROM authority_action ac
         JOIN authority_user u ON u.user_id = ac.user_id
         JOIN area a ON a.area_id = ac.area_id
         LEFT JOIN complaint co ON co.complaint_id = ac.complaint_id
         LEFT JOIN citizen c ON c.citizen_id = co.citizen_id
         WHERE ac.action_id = ?`,
        [id]
      );
      return rows[0] || null;
    });
  }

  async findByComplaintId(complaintId) {
    return this.findAll({ complaint_id: complaintId });
  }

  async create({ user_id, area_id, action_type, notes, complaint_id }) {
    return pool.executeWithRetry(async () => {
      const [result] = await pool.execute(
        `INSERT INTO authority_action
          (user_id, area_id, complaint_id, action_type, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [user_id, area_id, complaint_id || null, action_type, notes || null]
      );
      return this.findById(result.insertId);
    });
  }

  async update(id, data) {
    return pool.executeWithRetry(async () => {
      const existing = await this.findById(id);
      if (!existing) return null;

      const merged = {
        area_id: data.area_id ?? existing.area_id,
        complaint_id:
          data.complaint_id !== undefined ? data.complaint_id || null : existing.complaint_id,
        action_type: data.action_type ?? existing.action_type,
        notes: data.notes !== undefined ? data.notes : existing.notes,
      };

      await pool.execute(
        `UPDATE authority_action
         SET area_id = ?, complaint_id = ?, action_type = ?, notes = ?
         WHERE action_id = ?`,
        [merged.area_id, merged.complaint_id, merged.action_type, merged.notes, id]
      );
      return this.findById(id);
    });
  }

  async delete(id) {
    return pool.executeWithRetry(async () => {
      const [result] = await pool.execute("DELETE FROM authority_action WHERE action_id = ?", [id]);
      return result.affectedRows > 0;
    });
  }
}

module.exports = new ActionRepository();