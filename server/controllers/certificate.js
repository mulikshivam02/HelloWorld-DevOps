const path = require("path")
const crypto = require("crypto")
const PDFDocument = require("pdfkit")
const QRCode = require("qrcode")

const Course = require("../models/Course")
const CourseProgress = require("../models/CourseProgress")
const Certificate = require("../models/Certificate")
const User = require("../models/User")

const toTitleCase = (str) =>
  str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

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
        studentName: toTitleCase(`${student.firstName} ${student.lastName}`),
        courseName: course.courseName,
        instructorName: course.instructor
          ? toTitleCase(`${course.instructor.firstName} ${course.instructor.lastName}`)
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

    const W = doc.page.width
    const H = doc.page.height
    const GOLD = "#FFD60A"
    const DARK = "#000814"
    const SLATE = "#2C333F"
    const GRAY = "#6E727F"

    // ---- Double border frame ----
    doc.lineWidth(2).strokeColor(GOLD).rect(20, 20, W - 40, H - 40).stroke()
    doc.lineWidth(0.75).strokeColor(DARK).rect(30, 30, W - 60, H - 60).stroke()

    // ---- Logo (real site logo) ----
    doc.image(path.join(__dirname, "../assets/logo.png"), 60, 45, { height: 42 })
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(GRAY)
      .text("Online Learning Platform", 60, 91)

    // ---- Title ----
    doc
      .fontSize(34)
      .font("Times-Bold")
      .fillColor(DARK)
      .text("Certificate of Completion", 0, 135, { align: "center" })

    // ---- Divider with center diamond ----
    const dividerY = 182
    doc.lineWidth(1.5).strokeColor(GOLD)
      .moveTo(W / 2 - 140, dividerY).lineTo(W / 2 - 8, dividerY).stroke()
      .moveTo(W / 2 + 8, dividerY).lineTo(W / 2 + 140, dividerY).stroke()
    doc.save()
    doc.translate(W / 2, dividerY)
    doc.rotate(45)
    doc.rect(-5, -5, 10, 10).fill(GOLD)
    doc.restore()

    // ---- Body ----
    doc
      .fontSize(13)
      .font("Times-Italic")
      .fillColor(GRAY)
      .text("This is to certify that", 0, 205, { align: "center" })

    doc
      .fontSize(28)
      .font("Times-Bold")
      .fillColor(DARK)
      .text(certificate.studentName, 0, 228, { align: "center" })

    const nameWidth = doc.widthOfString(certificate.studentName, { font: "Times-Bold", size: 28 })
    doc.lineWidth(1).strokeColor(GOLD)
      .moveTo(W / 2 - nameWidth / 2, 262).lineTo(W / 2 + nameWidth / 2, 262).stroke()

    doc
      .fontSize(13)
      .font("Times-Roman")
      .fillColor(GRAY)
      .text("has successfully completed the course", 0, 275, { align: "center" })

    doc
      .fontSize(20)
      .font("Times-Bold")
      .fillColor(SLATE)
      .text(certificate.courseName, 0, 297, { align: "center" })

    if (certificate.instructorName) {
      doc
        .fontSize(11)
        .font("Times-Italic")
        .fillColor(GRAY)
        .text(`Instructor: ${certificate.instructorName}`, 0, 332, { align: "center" })
    }

    // ---- Footer: date + code (left), seal (center), QR (right) ----
    const footerY = H - 130

    doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY).text("ISSUED ON", 70, footerY)
    doc.fontSize(12).font("Helvetica").fillColor(DARK)
      .text(certificate.issuedDate.toDateString(), 70, footerY + 14)

    doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY).text("VERIFICATION CODE", 70, footerY + 40)
    doc.fontSize(13).font("Courier-Bold").fillColor(DARK)
      .text(certificate.verificationCode, 70, footerY + 54)

    // Seal
    const sealX = W / 2
    const sealY = H - 95
    doc.circle(sealX, sealY, 36).lineWidth(2).strokeColor(GOLD).stroke()
    doc.circle(sealX, sealY, 32).fill(DARK)
    doc
      .lineWidth(3)
      .strokeColor(GOLD)
      .lineCap("round")
      .lineJoin("round")
      .moveTo(sealX - 13, sealY - 4)
      .lineTo(sealX - 3, sealY + 6)
      .lineTo(sealX + 15, sealY - 12)
      .stroke()
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(GOLD)
      .text("VERIFIED", sealX - 32, sealY + 10, { width: 64, align: "center" })

    // QR
    doc.image(qrBuffer, W - 150, footerY + 5, { width: 80 })
    doc.fontSize(8).font("Helvetica").fillColor(GRAY)
      .text("Scan to verify", W - 150, footerY + 88, { width: 80, align: "center" })

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