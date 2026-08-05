// repositories/area.repository.js
const pool = require("../db/pool");

class AreaRepository {
  async findAll({ division, region_type, search } = {}) {
    let sql = "SELECT * FROM area WHERE 1=1";
    const params = [];
    if (division) {
      sql += " AND division = ?";
      params.push(division);
    }
    if (region_type) {
      sql += " AND region_type = ?";
      params.push(region_type);
    }
    if (search) {
      sql += " AND area_name LIKE ?";
      params.push(`%${search}%`);
    }
    sql += " ORDER BY division, area_name";

    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    });
  }

  async findDivisions() {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.query("SELECT DISTINCT division FROM area ORDER BY division");
      return rows.map((r) => r.division);
    });
  }

  async findById(id) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute("SELECT * FROM area WHERE area_id = ?", [id]);
      return rows[0] || null;
    });
  }

  async create({ area_name, division, region_type, zip_code }) {
    return pool.executeWithRetry(async () => {
      const [result] = await pool.execute(
        "INSERT INTO area (area_name, division, region_type, zip_code) VALUES (?, ?, ?, ?)",
        [area_name, division, region_type, zip_code || null]
      );
      return this.findById(result.insertId);
    });
  }

  async update(id, { area_name, division, region_type, zip_code }) {
    return pool.executeWithRetry(async () => {
      const existing = await this.findById(id);
      if (!existing) return null;

      const newName = area_name !== undefined ? area_name : existing.area_name;
      const newDivision = division !== undefined ? division : existing.division;
      const newRegionType = region_type !== undefined ? region_type : existing.region_type;
      const newZipCode = zip_code !== undefined ? zip_code : existing.zip_code;

      await pool.execute(
        "UPDATE area SET area_name = ?, division = ?, region_type = ?, zip_code = ? WHERE area_id = ?",
        [newName, newDivision, newRegionType, newZipCode, id]
      );
      return this.findById(id);
    });
  }

  async delete(id) {
    return pool.executeWithRetry(async () => {
      const existing = await this.findById(id);
      if (!existing) return false;
      await pool.execute("DELETE FROM area WHERE area_id = ?", [id]);
      return true;
    });
  }

  async getAreaReport(id) {
    return pool.executeWithRetry(async () => {
      const [resultSets] = await pool.query("CALL sp_area_report(?)", [id]);
      const [areaRows, analysisRows, riskRows, countRows] = resultSets;
      if (!areaRows || !areaRows[0]) return null;
      return {
        area: areaRows[0],
        latest_monthly_analysis: analysisRows[0] || null,
        current_risk_flag: riskRows[0] || null,
        ...countRows[0],
      };
    });
  }
}

module.exports = new AreaRepository();
