import { pool } from "../config/mysql.js";
import {
  getOrCreateMySQLUserId,
  getOrCreateMySQLDoctorId,
} from "../Helpers/mongoDbHelper.js";

async function createDiagnosis(req, res) {
  try {
    const {
      _id,
      userData,
      diagnosis_title,
      description,
      diagnosis_date,
      medications = [],
      future_checkups = [],
    } = req.body;

    const mongoDoctorId = req.doctorId;

    if (!_id || !diagnosis_title || !userData?.name) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: Patient ID, diagnosis title, and patient name are required",
      });
    }

    const userId = await getOrCreateMySQLUserId(_id, userData);
    const doctorId = await getOrCreateMySQLDoctorId(mongoDoctorId);

    if (!doctorId) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found in database",
      });
    }

    const [diagnosisResult] = await pool.execute(
      `INSERT INTO diagnosis (user_id, doctor_id, diagnosis_title, description, diagnosis_date)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        doctorId,
        diagnosis_title,
        description || null,
        diagnosis_date ||
          new Date().toISOString().slice(0, 19).replace("T", " "),
      ]
    );

    const diagnosisId = diagnosisResult.insertId;

    if (medications.length > 0) {
      await Promise.all(
        medications.map((med) =>
          pool.execute(
            `INSERT INTO medications (diagnosis_id, medication_name, dosage, duration, notes)
           VALUES (?, ?, ?, ?, ?)`,
            [
              diagnosisId,
              med.medication_name,
              med.dosage,
              med.duration,
              med.notes || null,
            ]
          )
        )
      );
    }

    if (future_checkups.length > 0) {
      await Promise.all(
        future_checkups.map((checkup) =>
          pool.execute(
            `INSERT INTO future_checkups (diagnosis_id, checkup_date, purpose, notes)
           VALUES (?, ?, ?, ?)`,
            [
              diagnosisId,
              checkup.checkup_date,
              checkup.purpose,
              checkup.notes || null,
            ]
          )
        )
      );
    }

    return res.status(201).json({
      success: true,
      message: "Diagnosis created successfully",
      diagnosisId,
      userId,
    });
  } catch (error) {
    console.error("Diagnosis creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create diagnosis",
      error: error.message,
    });
  }
}

async function getDiagnoses(req, res) {
  try {
    const mongoDoctorId = req.doctorId;

    const [doctorRows] = await pool.execute(
      `SELECT id FROM doctors WHERE mongo_id = ?`,
      [mongoDoctorId]
    );

    if (doctorRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const doctorId = doctorRows[0].id;

    const [diagnoses] = await pool.execute(
      `SELECT d.*, u.name AS patient_name, u.dob AS patient_dob
   FROM diagnosis d
   JOIN users u ON d.user_id = u.id
   WHERE d.doctor_id = ?
   ORDER BY d.diagnosis_date DESC`,
      [doctorId]
    );

    return res.status(200).json({
      success: true,
      diagnoses,
    });
  } catch (error) {
    console.error("Error fetching diagnoses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch diagnoses",
      error: error.message,
    });
  }
}

export { createDiagnosis, getDiagnoses };