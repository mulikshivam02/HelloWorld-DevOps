const mongoose = require("mongoose")

const certificateSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  studentName: { type: String, required: true },
  courseName: { type: String, required: true },
  instructorName: { type: String },
  verificationCode: { type: String, required: true, unique: true },
  issuedDate: { type: Date, default: Date.now },
})

// One certificate per (user, course) - reuse it rather than minting duplicates
certificateSchema.index({ course: 1, user: 1 }, { unique: true })

module.exports = mongoose.model("Certificate", certificateSchema)