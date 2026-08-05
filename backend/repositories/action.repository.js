// repositories/action.repository.js
const pool = require("../db/pool");

class ActionRepository {
  async findAll({ area_id, complaint_id } = {}) {
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
    sql += " ORDER BY ac.action_time DESC";

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
        "INSERT INTO authority_action (user_id, area_id, complaint_id, action_type, notes) VALUES (?, ?, ?, ?, ?)",
        [user_id, area_id, complaint_id || null, action_type, notes || null]
      );
      return this.findById(result.insertId);
    });
  }
}

module.exports = new ActionRepository();
