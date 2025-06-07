import { pool } from "../config/mysql.js";
import doctorModel from "../models/doctorModel.js";

export async function getOrCreateMySQLUserId(mongoUserId, userData) {
  try {
    const [rows] = await pool.execute(
      "SELECT id FROM users WHERE mongo_id = ?",
      [mongoUserId]
    );

    if (rows.length > 0) {
      return rows[0].id;
    }

    const [result] = await pool.execute(
      `INSERT INTO users (mongo_id, name, gender, dob, phone )
       VALUES (?, ?, ?, ?, ? )`,
      [
        mongoUserId,
        userData.name,
        userData.gender || null,
        userData.dob || null,
        userData.phone || null,
      ]
    );

    return result.insertId;
  } catch (error) {
    console.error("Error in getOrCreateMySQLUserId:", error);
    throw error;
  }
}

export async function getOrCreateMySQLDoctorId(mongoDoctorId) {
  try {
    const [rows] = await pool.execute(
      "SELECT id FROM doctors WHERE mongo_id = ?",
      [mongoDoctorId]
    );

    if (rows.length > 0) {
      return rows[0].id;
    }

    const doctor = await doctorModel.findById(mongoDoctorId);
    if (!doctor) {
      throw new Error("Doctor not found in MongoDB");
    }

    const [result] = await pool.execute(
      `INSERT INTO doctors (mongo_id, name, email)
   VALUES (?, ?, ?)`,
      [doctor._id.toString(), doctor.name, doctor.email || null]
    );

    return result.insertId;
  } catch (error) {
    console.error("Error in getOrCreateMySQLDoctorId:", error);
    throw error;
  }
}
