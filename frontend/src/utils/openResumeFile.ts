import toast from "react-hot-toast";
import { resumeApi } from "../lib/api";

/**
 * Fetch a resume file (authenticated) and open it in a new tab — PDFs render
 * inline in the browser; other types (e.g. DOCX) are downloaded instead since
 * browsers can't preview them.
 */
export async function openResumeFile(resumeId: number, fileName?: string): Promise<void> {
  try {
    const res = await resumeApi.getFile(resumeId);
    const blob: Blob = res.data;
    const url = URL.createObjectURL(blob);

    if (blob.type === "application/pdf") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `resume-${resumeId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404) {
      toast.error("Resume file not found on the server");
    } else if (status === 403) {
      toast.error("You are not authorized to view this resume");
    } else {
      toast.error("Failed to open resume");
    }
  }
}
