const express = require("express")
const router = express.Router()

const { auth, isStudent } = require("../middleware/auth")
const { generateCertificate, verifyCertificate } = require("../controllers/certificate")

router.post("/generate", auth, isStudent, generateCertificate)
router.get("/verify/:code", verifyCertificate)

module.exports = router