import mongoose from "mongoose";

const connectDB = async () => {
  mongoose.connection.on("connected", () =>
    console.log("MongoDB Connected Successfully")
  );

  await mongoose.connect(`${process.env.MONGODB_URL}/medilink`);
};

export default connectDB;
