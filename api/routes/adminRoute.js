import express from "express";
import {
  addDoctor,
  allDoctors,
  loginAdmin,
  appointmentsAdmin,
  appointmentCancel,
  adminDashboard,
  appointmentCompleteAdmin,
  getAllDiagnoses,
  deleteDoctor,
} from "../controllers/adminController.js";
import upload from "../middlewares/multer.js";
import authAdmin from "../middlewares/authAdmin.js";
import { changeAvailability } from "../controllers/doctorController.js";

const adminRouter = express.Router();

adminRouter.post("/add-doctor", authAdmin, upload.single("image"), addDoctor);
adminRouter.post("/login", loginAdmin);
adminRouter.post("/all-doctors", authAdmin, allDoctors);
adminRouter.post("/change-availability", authAdmin, changeAvailability);
adminRouter.get("/appointments", authAdmin, appointmentsAdmin);
adminRouter.put("/cancel-appointment", authAdmin, appointmentCancel);
adminRouter.post("/complete-appointment", authAdmin, appointmentCompleteAdmin);
adminRouter.get("/dashboard", authAdmin, adminDashboard);
adminRouter.get("/get-diagnosis", authAdmin, getAllDiagnoses);
adminRouter.delete("/delete-doctor/:doctorId", authAdmin, deleteDoctor);

export default adminRouter;
