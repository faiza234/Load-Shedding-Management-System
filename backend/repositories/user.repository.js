// repositories/user.repository.js
const pool = require("../db/pool");
const bcrypt = require("bcryptjs");

class UserRepository {
  async getUserAreas(userId) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(
        `SELECT a.area_id, a.area_name, a.division, a.region_type, a.zip_code, aua.assigned_at
         FROM authority_user_area aua
         JOIN area a ON a.area_id = aua.area_id
         WHERE aua.user_id = ?
         ORDER BY a.division, a.area_name`,
        [userId]
      );
      return rows;
    });
  }

  async findAll() {
    return pool.executeWithRetry(async () => {
      const [users] = await pool.execute(
        "SELECT user_id, user_name, role, contact_email, created_at FROM authority_user ORDER BY user_name"
      );
      for (const u of users) {
        u.assigned_areas = await this.getUserAreas(u.user_id);
      }
      return users;
    });
  }

  async findByUsername(userName) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(
        "SELECT user_id, user_name, password_hash, contact_email, role FROM authority_user WHERE user_name = ?",
        [userName]
      );
      if (!rows[0]) return null;
      const user = rows[0];
      user.assigned_areas = await this.getUserAreas(user.user_id);
      return user;
    });
  }

  async findById(id) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(
        "SELECT user_id, user_name, role, contact_email, created_at FROM authority_user WHERE user_id = ?",
        [id]
      );
      if (!rows[0]) return null;
      const user = rows[0];
      user.assigned_areas = await this.getUserAreas(user.user_id);
      return user;
    });
  }

  async create({ user_name, password, contact_email, role = "officer", area_ids, area_id }) {
    return pool.executeWithRetry(async () => {
      return pool.withTransaction(async (connection) => {
        const password_hash = bcrypt.hashSync(password, 8);
        const [result] = await connection.execute(
          "INSERT INTO authority_user (user_name, password_hash, contact_email, role) VALUES (?, ?, ?, ?)",
          [user_name, password_hash, contact_email || null, role]
        );
        const userId = result.insertId;

        // Support both area_ids array or single area_id
        let targetAreas = [];
        if (Array.isArray(area_ids)) {
          targetAreas = area_ids;
        } else if (area_id) {
          targetAreas = [area_id];
        }

        for (const aId of targetAreas) {
          await connection.execute(
            "INSERT IGNORE INTO authority_user_area (user_id, area_id) VALUES (?, ?)",
            [userId, aId]
          );
        }

        const [rows] = await connection.execute(
          "SELECT user_id, user_name, role, contact_email, created_at FROM authority_user WHERE user_id = ?",
          [userId]
        );
        const user = rows[0];
        const [areaRows] = await connection.execute(
          `SELECT a.area_id, a.area_name, a.division, a.region_type, a.zip_code, aua.assigned_at
           FROM authority_user_area aua
           JOIN area a ON a.area_id = aua.area_id
           WHERE aua.user_id = ?
           ORDER BY a.division, a.area_name`,
          [userId]
        );
        user.assigned_areas = areaRows;
        return user;
      });
    });
  }

  async update(id, { user_name, password, contact_email, role, area_ids }) {
    return pool.executeWithRetry(async () => {
      return pool.withTransaction(async (connection) => {
        const existing = await this.findById(id);
        if (!existing) return null;

        const newName = user_name !== undefined ? user_name : existing.user_name;
        const newEmail = contact_email !== undefined ? contact_email : existing.contact_email;
        const newRole = role !== undefined ? role : existing.role;

        if (password) {
          const password_hash = bcrypt.hashSync(password, 8);
          await connection.execute(
            "UPDATE authority_user SET user_name = ?, password_hash = ?, contact_email = ?, role = ? WHERE user_id = ?",
            [newName, password_hash, newEmail, newRole, id]
          );
        } else {
          await connection.execute(
            "UPDATE authority_user SET user_name = ?, contact_email = ?, role = ? WHERE user_id = ?",
            [newName, newEmail, newRole, id]
          );
        }

        if (Array.isArray(area_ids)) {
          await connection.execute(
            "DELETE FROM authority_user_area WHERE user_id = ?",
            [id]
          );
          for (const aId of area_ids) {
            await connection.execute(
              "INSERT IGNORE INTO authority_user_area (user_id, area_id) VALUES (?, ?)",
              [id, aId]
            );
          }
        }

        const [rows] = await connection.execute(
          "SELECT user_id, user_name, role, contact_email, created_at FROM authority_user WHERE user_id = ?",
          [id]
        );
        const user = rows[0];
        const [areaRows] = await connection.execute(
          `SELECT a.area_id, a.area_name, a.division, a.region_type, a.zip_code, aua.assigned_at
           FROM authority_user_area aua
           JOIN area a ON a.area_id = aua.area_id
           WHERE aua.user_id = ?
           ORDER BY a.division, a.area_name`,
          [id]
        );
        user.assigned_areas = areaRows;
        return user;
      });
    });
  }

  async delete(id) {
    return pool.executeWithRetry(async () => {
      const existing = await this.findById(id);
      if (!existing) return false;
      await pool.execute("DELETE FROM authority_user WHERE user_id = ?", [id]);
      return true;
    });
  }

  async assignArea(userId, areaId) {
    return pool.executeWithRetry(async () => {
      await pool.execute(
        "INSERT IGNORE INTO authority_user_area (user_id, area_id) VALUES (?, ?)",
        [userId, areaId]
      );
      return this.getUserAreas(userId);
    });
  }

  async removeArea(userId, areaId) {
    return pool.executeWithRetry(async () => {
      await pool.execute(
        "DELETE FROM authority_user_area WHERE user_id = ? AND area_id = ?",
        [userId, areaId]
      );
      return this.getUserAreas(userId);
    });
  }

  async setAreas(userId, areaIds = []) {
    return pool.executeWithRetry(async () => {
      return pool.withTransaction(async (connection) => {
        await connection.execute(
          "DELETE FROM authority_user_area WHERE user_id = ?",
          [userId]
        );
        for (const areaId of areaIds) {
          await connection.execute(
            "INSERT INTO authority_user_area (user_id, area_id) VALUES (?, ?)",
            [userId, areaId]
          );
        }
        const [rows] = await connection.execute(
          `SELECT a.area_id, a.area_name, a.division, a.region_type, a.zip_code, aua.assigned_at
           FROM authority_user_area aua
           JOIN area a ON a.area_id = aua.area_id
           WHERE aua.user_id = ?
           ORDER BY a.division, a.area_name`,
          [userId]
        );
        return rows;
      });
    });
  }
}

module.exports = new UserRepository();


