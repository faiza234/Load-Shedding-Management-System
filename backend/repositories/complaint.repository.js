// repositories/complaint.repository.js
const pool = require("../db/pool");
const citizenRepository = require("./citizen.repository");

class ComplaintRepository {
  async findAll({ area_id, status, search } = {}) {
    let sql = `
      SELECT co.*, c.full_name AS citizen_name, c.phone AS citizen_phone,
             a.area_name, a.division
      FROM complaint co
      JOIN citizen c ON c.citizen_id = co.citizen_id
      JOIN area a ON a.area_id = co.area_id
      WHERE 1=1`;
    const params = [];
    if (area_id) {
      sql += " AND co.area_id = ?";
      params.push(area_id);
    }
    if (status) {
      sql += " AND co.status = ?";
      params.push(status);
    }
    if (search) {
      sql += " AND co.description LIKE ?";
      params.push(`%${search}%`);
    }
    sql += " ORDER BY co.reported_at DESC";

    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(sql, params);
      return rows.map((row) => ({
        ...row,
        recommended_step: this.getRecommendedStep(row.description),
      }));
    });
  }

  async findById(id) {
    return pool.executeWithRetry(async () => {
      const [rows] = await pool.execute(
        `SELECT co.*, c.full_name AS citizen_name, c.phone AS citizen_phone,
                a.area_name, a.division
         FROM complaint co
         JOIN citizen c ON c.citizen_id = co.citizen_id
         JOIN area a ON a.area_id = co.area_id
         WHERE co.complaint_id = ?`,
        [id]
      );
      if (!rows[0]) return null;
      return {
        ...rows[0],
        recommended_step: this.getRecommendedStep(rows[0].description),
      };
    });
  }

  getRecommendedStep(description = "") {
    const text = String(description).toLowerCase();
    if (text.includes("sparking") || text.includes("transformer")) {
      return {
        category: "Hardware Emergency",
        recommendedAction: "Emergency Repair Dispatch",
        suggestedStep: "Dispatch local emergency technical team immediately to inspect and isolate damaged transformer components.",
        urgency: "Critical",
        targetStatus: "in_review",
      };
    }
    if (text.includes("unscheduled") || text.includes("outside")) {
      return {
        category: "Schedule Misalignment",
        recommendedAction: "Schedule Adjustment",
        suggestedStep: "Recalibrate grid feeder timetable and issue updated schedule notice to sync load distribution.",
        urgency: "Medium",
        targetStatus: "in_review",
      };
    }
    if (text.includes("voltage") || text.includes("fluctuation")) {
      return {
        category: "Grid Power Quality",
        recommendedAction: "Substation Audit",
        suggestedStep: "Inspect sub-station transformer step-down ratio and execute feeder load balancing across key circuits.",
        urgency: "High",
        targetStatus: "in_review",
      };
    }
    if (text.includes("water") || text.includes("street") || text.includes("business")) {
      return {
        category: "Critical Public Service",
        recommendedAction: "Public Notice Issued",
        suggestedStep: "Issue priority restoration advisory and dispatch backup maintenance unit to public infrastructure line.",
        urgency: "High",
        targetStatus: "in_review",
      };
    }
    return {
      category: "General Outage",
      recommendedAction: "Site Inspection",
      suggestedStep: "Conduct on-site line inspection and review local distribution feeder state.",
      urgency: "Normal",
      targetStatus: "in_review",
    };
  }

  /**
   * Atomic multi-step complaint creation inside transaction to ensure zero race conditions.
   */
  async createWithTransaction({ citizen_id, full_name, phone, email, area_id, description, schedule_id }) {
    return pool.executeWithRetry(async () => {
      return pool.withTransaction(async (connection) => {
        let finalCitizenId = citizen_id;

        if (!finalCitizenId) {
          const citizen = await citizenRepository.findOrCreate(
            { full_name, phone, email, area_id },
            connection
          );
          finalCitizenId = citizen.citizen_id;
        }

        const [result] = await connection.execute(
          `INSERT INTO complaint (citizen_id, area_id, schedule_id, description, status)
           VALUES (?, ?, ?, ?, 'open')`,
          [finalCitizenId, area_id, schedule_id || null, description]
        );

        const [rows] = await connection.execute(
          "SELECT * FROM complaint WHERE complaint_id = ?",
          [result.insertId]
        );
        return rows[0];
      });
    });
  }

  async update(id, { status, resolution_note }) {
    return pool.executeWithRetry(async () => {
      const existing = await this.findById(id);
      if (!existing) return null;

      const newStatus = status ?? existing.status;
      const newNote = resolution_note !== undefined ? resolution_note : existing.resolution_note;

      await pool.execute(
        "UPDATE complaint SET status = ?, resolution_note = ? WHERE complaint_id = ?",
        [newStatus, newNote, id]
      );

      return this.findById(id);
    });
  }

  async delete(id) {
    return pool.executeWithRetry(async () => {
      const existing = await this.findById(id);
      if (!existing) return false;
      await pool.execute("DELETE FROM complaint WHERE complaint_id = ?", [id]);
      return true;
    });
  }
}

module.exports = new ComplaintRepository();
