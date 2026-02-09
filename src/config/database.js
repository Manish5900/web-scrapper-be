import mongoose from "mongoose";

export const db = async () => {
  try {
    await mongoose
      .connect(process.env.MONGO_URI)
      .then(() => console.log("=====Database connected successfully====="));
  } catch (error) {
    console.log(error);
  }
};
