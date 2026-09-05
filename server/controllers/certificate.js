const PDFDocument = require("pdfkit")
const QRCode = require("qrcode")
const crypto = require("crypto")

const Course = require("../models/Course")
const CourseProgress = require("../models/CourseProgress")
const Certificate = require("../models/Certificate")
const User = require("../models/User")

// POST /api/v1/certificate/generate   body: { courseId }
exports.generateCertificate = async (req, res) => {
  try {
    const userId = req.user.id
    const { courseId } = req.body

    if (!courseId) {
      return res.status(400).json({ success: false, message: "Course ID is required" })
    }

    const course = await Course.findById(courseId)
      .populate({ path: "courseContent", populate: { path: "subSection" } })
      .populate("instructor")

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" })
    }

    // Never trust the client on enrollment or completion - recheck both server-side
    const isEnrolled = course.studentsEnroled.some(
      (id) => id.toString() === userId.toString()
    )
    if (!isEnrolled) {
      return res.status(403).json({ success: false, message: "You are not enrolled in this course" })
    }

    let totalLectures = 0
    course.courseContent.forEach((section) => {
      totalLectures += section.subSection.length
    })

    if (totalLectures === 0) {
      return res.status(400).json({ success: false, message: "This course has no content" })
    }

    const courseProgress = await CourseProgress.findOne({ courseID: courseId, userId })
    const completedCount = courseProgress ? courseProgress.completedVideos.length : 0

    if (completedCount < totalLectures) {
      return res.status(400).json({
        success: false,
        message: `Course not yet completed (${completedCount}/${totalLectures} lectures done)`,
      })
    }

    const student = await User.findById(userId)

    // Reuse an existing certificate/code if one was already issued
    let certificate = await Certificate.findOne({ course: courseId, user: userId })

    if (!certificate) {
        const verificationCode = crypto.randomBytes(6).toString("hex").toUpperCase()
      certificate = await Certificate.create({
        course: courseId,
        user: userId,
        studentName: `${student.firstName} ${student.lastName}`,
        courseName: course.courseName,
        instructorName: course.instructor
          ? `${course.instructor.firstName} ${course.instructor.lastName}`
          : "",
        verificationCode,
      })
    }

    const clientUrl = process.env.CLIENT_URL || "http://helloworld.local"
    const verifyUrl = `${clientUrl}/verify-certificate/${certificate.verificationCode}`
    const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 200 })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificate-${course.courseName.replace(/\s+/g, "-")}.pdf"`
    )

    const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 50 })
    doc.pipe(res)

    doc
      .lineWidth(3)
      .strokeColor("#F1A93A")
      .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
      .stroke()

    doc
      .fontSize(36)
      .fillColor("#2C333F")
      .font("Helvetica-Bold")
      .text("Certificate of Completion", 0, 100, { align: "center" })

    doc
      .fontSize(14)
      .font("Helvetica")
      .fillColor("#555")
      .text("This certifies that", 0, 170, { align: "center" })

    doc
      .fontSize(30)
      .font("Helvetica-Bold")
      .fillColor("#000")
      .text(certificate.studentName, 0, 200, { align: "center" })

    doc
      .fontSize(14)
      .font("Helvetica")
      .fillColor("#555")
      .text("has successfully completed the course", 0, 250, { align: "center" })

    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor("#000")
      .text(certificate.courseName, 0, 280, { align: "center" })

    if (certificate.instructorName) {
      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("#555")
        .text(`Instructor: ${certificate.instructorName}`, 0, 330, { align: "center" })
    }

    doc
      .fontSize(11)
      .fillColor("#777")
      .text(`Issued on ${certificate.issuedDate.toDateString()}`, 70, doc.page.height - 130)

    doc
      .fontSize(11)
      .fillColor("#777")
      .text(`Verification Code: ${certificate.verificationCode}`, 70, doc.page.height - 110)

    doc.image(qrBuffer, doc.page.width - 160, doc.page.height - 160, { width: 90 })

    doc.end()
  } catch (error) {
    console.error(error)
    return res.status(500).json({ success: false, message: "Could not generate certificate" })
  }
}

// GET /api/v1/certificate/verify/:code   (public - no auth)
exports.verifyCertificate = async (req, res) => {
  try {
    const { code } = req.params
    const certificate = await Certificate.findOne({ verificationCode: code })

    if (!certificate) {
      return res.status(404).json({ valid: false, message: "No certificate found for this code" })
    }

    return res.status(200).json({
      valid: true,
      studentName: certificate.studentName,
      courseName: certificate.courseName,
      instructorName: certificate.instructorName,
      issuedDate: certificate.issuedDate,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ valid: false, message: "Server error" })
  }
}