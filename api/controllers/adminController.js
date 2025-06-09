import validator from "validator";
import bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";
import doctorModel from "../models/doctorModel.js";
import userModel from "../models/userModel.js";
import appointmentModel from "../models/appointmentModel.js";
import jwt from "jsonwebtoken";
import { pool } from "../config/mysql.js";

const addDoctor = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      specialty,
      degree,
      experience,
      about,
      fees,
      address,
    } = req.body;
    const imageFile = req.file;

    if (
      !name ||
      !email ||
      !password ||
      !specialty ||
      !degree ||
      !experience ||
      !about ||
      !fees ||
      !address
    ) {
      return res.json({ success: false, message: "Missing Details" });
    }

    if (!validator.isEmail(email)) {
      return res.json({
        success: false,
        message: "Please enter a valid email",
      });
    }

    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Please enter a strong password",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
      resource_type: "image",
    });
    const imageUrl = imageUpload.secure_url;

    const doctorData = {
      name,
      email,
      image: imageUrl,
      password: hashedPassword,
      specialty,
      degree,
      experience,
      about,
      fees,
      address: JSON.parse(address),
      date: Date.now(),
    };

    const newDoctor = new doctorModel(doctorData);
    await newDoctor.save();

    res.json({ success: true, message: "Doctor successfully added" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign(email + password, process.env.JWT_SECRET);
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const allDoctors = async (req, res) => {
  try {
    const doctors = await doctorModel.find({}).select("-password");
    res.json({ success: true, doctors });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const appointmentsAdmin = async (req, res) => {
  try {
    const appointments = await appointmentModel.find({});
    res.json({ success: true, appointments });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const appointmentCancel = async (req, res) => {
  try {
    const { appointmentId } = req.body;

    const appointmentData = await appointmentModel.findById(appointmentId);

    await appointmentModel.findByIdAndUpdate(appointmentId, {
      cancelled: true,
    });

    const { docId, slotDate, slotTime } = appointmentData;

    const doctorData = await doctorModel.findById(docId);

    let slots_booked = doctorData.slots_booked;

    slots_booked[slotDate] = slots_booked[slotDate].filter(
      (e) => e !== slotTime
    );

    await doctorModel.findByIdAndUpdate(docId, { slots_booked });

    res.json({ success: true, message: "Appointment Cancelled" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const appointmentCompleteAdmin = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const appointmentData = await appointmentModel.findById(appointmentId);
    if (!appointmentData) {
      return res.json({ success: false, message: "Appointment not found" });
    }
    await appointmentModel.findByIdAndUpdate(appointmentId, {
      isCompleted: true,
    });
    res.json({ success: true, message: "Appointment Completed" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const adminDashboard = async (req, res) => {
  try {
    const doctors = await doctorModel.find({});
    const users = await userModel.find({});
    const appointments = await appointmentModel.find({});

    const dashData = {
      doctors: doctors.length,
      appointments: appointments.length,
      patients: users.length,
      latestAppointments: appointments.reverse().slice(0, 10),
    };
    res.json({ success: true, dashData });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const getAllDiagnoses = async (req, res) => {
  try {
    const [diagnoses] = await pool.execute(
      `SELECT 
        d.id AS diagnosis_id, 
        d.diagnosis_title, 
        d.description, 
        d.diagnosis_date,
        u.id AS user_id, 
        u.mongo_id AS user_mongo_id,
        u.name AS patient_name, 
        u.gender AS patient_gender,
        u.dob AS patient_dob, 
        u.phone AS patient_phone,
        doc.id AS doctor_id,
        doc.mongo_id AS doctor_mongo_id,
        doc.name AS doctor_name,
        doc.email AS doctor_email
       FROM diagnosis d
       JOIN users u ON d.user_id = u.id
       JOIN doctors doc ON d.doctor_id = doc.id
       ORDER BY d.diagnosis_date DESC`
    );

    const diagnosisIds = diagnoses.map((d) => d.diagnosis_id);
    const userMongoIds = diagnoses.map((d) => d.user_mongo_id);
    const doctorMongoIds = diagnoses.map((d) => d.doctor_mongo_id);

    const [medications, futureCheckups, mongoUsers, mongoDoctors] =
      await Promise.all([
        // Medications
        diagnosisIds.length > 0
          ? pool
              .execute(
                `SELECT diagnosis_id, medication_name, dosage, duration, notes
             FROM medications
             WHERE diagnosis_id IN (${diagnosisIds.map(() => "?").join(",")})`,
                diagnosisIds
              )
              .then(([rows]) => rows)
          : Promise.resolve([]),

        diagnosisIds.length > 0
          ? pool
              .execute(
                `SELECT diagnosis_id, checkup_date, purpose, notes
             FROM future_checkups
             WHERE diagnosis_id IN (${diagnosisIds.map(() => "?").join(",")})`,
                diagnosisIds
              )
              .then(([rows]) => rows)
          : Promise.resolve([]),

        userModel
          .find({ _id: { $in: userMongoIds } }, { _id: 1, image: 1 })
          .lean(),

        doctorModel
          .find(
            { _id: { $in: doctorMongoIds } },
            { _id: 1, image: 1, specialty: 1 }
          )
          .lean(),
      ]);

    const medsMap = medications.reduce((acc, med) => {
      if (!acc[med.diagnosis_id]) acc[med.diagnosis_id] = [];
      acc[med.diagnosis_id].push({
        name: med.medication_name,
        dosage: med.dosage,
        duration: med.duration,
        notes: med.notes,
      });
      return acc;
    }, {});

    const checkupsMap = futureCheckups.reduce((acc, checkup) => {
      if (!acc[checkup.diagnosis_id]) acc[checkup.diagnosis_id] = [];
      acc[checkup.diagnosis_id].push({
        date: checkup.checkup_date,
        purpose: checkup.purpose,
        notes: checkup.notes,
      });
      return acc;
    }, {});

    const userImageMap = mongoUsers.reduce((acc, user) => {
      acc[user._id.toString()] = user.image;
      return acc;
    }, {});

    const doctorInfoMap = mongoDoctors.reduce((acc, doctor) => {
      acc[doctor._id.toString()] = {
        image: doctor.image,
        specialty: doctor.specialty,
      };
      return acc;
    }, {});

    const enrichedDiagnoses = diagnoses.map((d) => ({
      id: d.diagnosis_id,
      title: d.diagnosis_title,
      description: d.description,
      date: d.diagnosis_date,
      patient: {
        id: d.user_id,
        mongoId: d.user_mongo_id,
        name: d.patient_name,
        gender: d.patient_gender,
        dob: d.patient_dob,
        phone: d.patient_phone,
        image: userImageMap[d.user_mongo_id] || null,
      },
      doctor: {
        id: d.doctor_id,
        mongoId: d.doctor_mongo_id,
        name: d.doctor_name,
        email: d.doctor_email,
        image: doctorInfoMap[d.doctor_mongo_id]?.image || null,
        specialty: doctorInfoMap[d.doctor_mongo_id]?.specialty || null,
      },
      medications: medsMap[d.diagnosis_id] || [],
      futureCheckups: checkupsMap[d.diagnosis_id] || [],
    }));

    return res.status(200).json({
      success: true,
      count: enrichedDiagnoses.length,
      diagnoses: enrichedDiagnoses,
    });
  } catch (error) {
    console.error("Error fetching all diagnoses:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch diagnoses",
      error: error.message,
    });
  }
};

const deleteDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const deletedDoctor = await doctorModel.findByIdAndDelete(doctorId);
    if (!deletedDoctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found in MongoDB",
      });
    }

    const [mysqlDoctor] = await pool.execute(
      "SELECT id FROM doctors WHERE mongo_id = ?",
      [doctorId]
    );

    if (mysqlDoctor.length > 0) {
      await pool.execute(
        "DELETE FROM medications WHERE diagnosis_id IN (SELECT id FROM diagnosis WHERE doctor_id = ?)",
        [mysqlDoctor[0].id]
      );
      await pool.execute(
        "DELETE FROM future_checkups WHERE diagnosis_id IN (SELECT id FROM diagnosis WHERE doctor_id = ?)",
        [mysqlDoctor[0].id]
      );
      await pool.execute("DELETE FROM diagnosis WHERE doctor_id = ?", [
        mysqlDoctor[0].id,
      ]);
      await pool.execute("DELETE FROM doctors WHERE id = ?", [
        mysqlDoctor[0].id,
      ]);
    }

    res.json({
      success: true,
      message: "Doctor successfully deleted from both databases",
    });
  } catch (error) {
    console.error("Error deleting doctor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete doctor",
      error: error.message,
    });
  }
};

export {
  addDoctor,
  loginAdmin,
  allDoctors,
  appointmentsAdmin,
  appointmentCancel,
  adminDashboard,
  appointmentCompleteAdmin,
  getAllDiagnoses,
  deleteDoctor,
};
