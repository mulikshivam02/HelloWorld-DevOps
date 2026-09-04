import toast from "react-hot-toast"

import { axiosInstance } from "../apiConnector"
import { certificateEndpoints } from "../apis"

const { GENERATE_CERTIFICATE_API } = certificateEndpoints

export const generateCertificate = async (courseId, token) => {
  const toastId = toast.loading("Generating your certificate...")
  try {
    const response = await axiosInstance({
      method: "POST",
      url: GENERATE_CERTIFICATE_API,
      data: { courseId },
      headers: { Authorization: `Bearer ${token}` },
      responseType: "blob",
    })

    const blob = new Blob([response.data], { type: "application/pdf" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "certificate.pdf"
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    toast.success("Certificate downloaded!")
  } catch (error) {
    console.log("GENERATE_CERTIFICATE_API ERROR............", error)
    // responseType:"blob" means even error bodies arrive as a Blob, not JSON directly
    let message = "Could not generate certificate"
    try {
      const text = await error.response.data.text()
      message = JSON.parse(text).message || message
    } catch (_) {
      // keep the generic message
    }
    toast.error(message)
  }
  toast.dismiss(toastId)
}