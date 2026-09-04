import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa"

import { certificateEndpoints } from "../services/apis"

const { VERIFY_CERTIFICATE_API } = certificateEndpoints

export default function VerifyCertificate() {
  const { code } = useParams()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${VERIFY_CERTIFICATE_API}/${code}`)
        const data = await res.json()
        setResult(data)
      } catch (error) {
        setResult({ valid: false, message: "Could not reach verification service" })
      }
      setLoading(false)
    })()
  }, [code])

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col items-center justify-center gap-4 px-4 text-center text-richblack-5">
      {loading ? (
        <div className="spinner"></div>
      ) : result?.valid ? (
        <>
          <FaCheckCircle className="text-6xl text-caribbeangreen-100" />
          <p className="text-2xl font-bold">Certificate Verified</p>
          <div className="mt-4 w-full rounded-lg border border-richblack-600 bg-richblack-800 p-6 text-left">
            <p><span className="text-richblack-400">Student:</span> {result.studentName}</p>
            <p><span className="text-richblack-400">Course:</span> {result.courseName}</p>
            {result.instructorName && (
              <p><span className="text-richblack-400">Instructor:</span> {result.instructorName}</p>
            )}
            <p><span className="text-richblack-400">Issued:</span> {new Date(result.issuedDate).toDateString()}</p>
          </div>
        </>
      ) : (
        <>
          <FaTimesCircle className="text-6xl text-pink-200" />
          <p className="text-2xl font-bold">Invalid Certificate</p>
          <p className="text-richblack-300">
            {result?.message || "This verification code does not match any issued certificate."}
          </p>
        </>
      )}
    </div>
  )
}