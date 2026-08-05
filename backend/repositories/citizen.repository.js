// repositories/citizen.repository.js
const pool = require("../db/pool");

class CitizenRepository {
  async findAll({ area_id, search } = {}) {
    let sql = `
      SELECT c.*, a.area_name, a.division
      FROM citizen c JOIN area a ON a.area_id = c.area_id
      WHERE 1=1`;
    const params = [];
    if (area_id) {
      sql += " AND c.area_id = ?";
      params.push(area_id);
    }
    if (search) {
      sql += " AND (c.full_name LIKE ? OR c.phone LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += " ORDER BY c.full_name";

    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    });
  }

  async findById(id, connection = pool) {
    const executor = connection || pool;
    const [rows] = await executor.execute("SELECT * FROM citizen WHERE citizen_id = ?", [id]);
    return rows[0] || null;
  }

  async create({ full_name, phone, email, area_id }, connection = pool) {
    const executor = connection || pool;
    const [result] = await executor.execute(
      "INSERT INTO citizen (full_name, phone, email, area_id) VALUES (?, ?, ?, ?)",
      [full_name, phone || null, email || null, area_id]
    );
    return this.findById(result.insertId, executor);
  }

  /**
   * Concurrency & duplicate safe citizen lookup or creation inside transaction
   */
  async findOrCreate({ full_name, phone, email, area_id }, connection = pool) {
    const executor = connection || pool;

    if (phone) {
      const [existing] = await executor.execute(
        "SELECT * FROM citizen WHERE phone = ? AND area_id = ? FOR UPDATE",
        [phone, area_id]
      );
      if (existing[0]) return existing[0];
    }

    if (full_name) {
      const [existing] = await executor.execute(
        "SELECT * FROM citizen WHERE full_name = ? AND area_id = ? FOR UPDATE",
        [full_name, area_id]
      );
      if (existing[0]) return existing[0];
    }

    return this.create({ full_name, phone, email, area_id }, executor);
  }
}

module.exports = new CitizenRepository();
