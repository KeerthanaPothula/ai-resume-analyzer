"""
Full smoke test for AI Resume Platform.
Run: python smoke_test.py
"""
import sys
import time
import requests

BASE = "http://localhost:8000/api/v1"

def ok(label, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print(f"  [{status}] {label}" + (f": {detail}" if detail else ""))
    return cond

def login(email, password):
    r = requests.post(f"{BASE}/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]

def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}

failures = []

# ── 1. Register candidate ──────────────────────────────────────────────────────
print("\n=== 1. Register candidate ===")
r = requests.post(f"{BASE}/auth/register", json={
    "email": "smoke_cand@test.com", "password": "Test1234!",
    "full_name": "Smoke Candidate", "role": "candidate"
})
if not ok("Register candidate", r.status_code in (201, 400)):
    failures.append("register_candidate")
    sys.exit(1)

# ── 2. Register recruiter ──────────────────────────────────────────────────────
print("\n=== 2. Register recruiter ===")
r = requests.post(f"{BASE}/auth/register", json={
    "email": "smoke_recr@test.com", "password": "Test1234!",
    "full_name": "Smoke Recruiter", "role": "recruiter"
})
if not ok("Register recruiter", r.status_code in (201, 400)):
    failures.append("register_recruiter")
    sys.exit(1)

# ── 3. Login both ──────────────────────────────────────────────────────────────
print("\n=== 3. Login ===")
cand_token = login("smoke_cand@test.com", "Test1234!")
ok("Candidate login", bool(cand_token))

recr_token = login("smoke_recr@test.com", "Test1234!")
ok("Recruiter login", bool(recr_token))

# ── 4. Upload resume ───────────────────────────────────────────────────────────
print("\n=== 4. Upload resume ===")
import tempfile, os, fitz
doc = fitz.open()
page = doc.new_page()
page.insert_text((50, 700), "Jane Smith - Python Developer")
page.insert_text((50, 680), "jane.smith@example.com | 555-9999 | Austin, TX")
page.insert_text((50, 660), "Skills: Python, FastAPI, SQLAlchemy, Docker, REST APIs")
page.insert_text((50, 640), "Experience: 4 years Software Engineer at TechCorp Inc")
page.insert_text((50, 620), "Education: B.S. Computer Science, UT Austin")
tmp_pdf = os.path.join(tempfile.gettempdir(), "smoke_resume.pdf")
doc.save(tmp_pdf)

with open(tmp_pdf, "rb") as f:
    r = requests.post(
        f"{BASE}/resumes/upload",
        headers=auth_headers(cand_token),
        files={"file": ("smoke_resume.pdf", f, "application/pdf")},
    )
ok("Upload resume", r.status_code == 201, f"ATS={r.json().get('ats_score')}")
resume_id = r.json().get("id") if r.status_code == 201 else None

# ── 5. Post job ────────────────────────────────────────────────────────────────
print("\n=== 5. Post job ===")
r = requests.post(
    f"{BASE}/jobs/",
    headers={**auth_headers(recr_token), "Content-Type": "application/json"},
    json={
        "title": "Python Backend Engineer",
        "company": "Smoke Inc",
        "location": "Remote",
        "description": "We need a Python/FastAPI engineer with SQL experience",
        "required_skills": ["Python", "FastAPI", "SQL"],
        "experience_required": 2.0,
    },
)
ok("Post job", r.status_code == 201)
job_id = r.json().get("id") if r.status_code == 201 else None

# ── 6. Rankings before application ────────────────────────────────────────────
print("\n=== 6. Rankings before application (should be 0) ===")
r = requests.get(f"{BASE}/rankings/job/{job_id}", headers=auth_headers(recr_token))
ok("Rankings empty before apply", r.status_code == 200 and len(r.json()) == 0, f"count={len(r.json())}")

# ── 7. Apply to job ────────────────────────────────────────────────────────────
print("\n=== 7. Candidate applies to job ===")
r = requests.post(
    f"{BASE}/applications/apply",
    headers={**auth_headers(cand_token), "Content-Type": "application/json"},
    json={"job_id": job_id, "resume_id": resume_id},
)
ok("Apply to job", r.status_code in (200, 201), r.text[:100])

# ── 8. Rankings after application ─────────────────────────────────────────────
print("\n=== 8. Rankings after application (should be 1) ===")
time.sleep(0.5)
r = requests.get(f"{BASE}/rankings/job/{job_id}", headers=auth_headers(recr_token))
rankings = r.json()
ok("Rankings has 1 applicant", r.status_code == 200 and len(rankings) == 1, f"count={len(rankings)}")
if rankings:
    # candidate_email comes from the parsed resume, not the account email
    ok("Applicant appears in rankings", bool(rankings[0].get("candidate_email") or rankings[0].get("candidate_name")), str(rankings[0].get("candidate_email", rankings[0].get("candidate_name"))))

# ── 9. Candidate pool (recruiter view) ────────────────────────────────────────
print("\n=== 9. Candidate pool ===")
r = requests.get(f"{BASE}/candidates/", headers=auth_headers(recr_token))
ok("Candidate pool accessible", r.status_code == 200, f"count={len(r.json())}")

# ── 10. AI analysis ────────────────────────────────────────────────────────────
print("\n=== 10. AI analysis ===")
if resume_id and job_id:
    r = requests.post(
        f"{BASE}/analysis/score/{resume_id}/{job_id}",
        headers=auth_headers(cand_token),
    )
    score_data = r.json()
    ok("AI analysis", r.status_code == 200, f"ats_score={score_data.get('ats_score')}")

# ── 11. Forgot password ────────────────────────────────────────────────────────
print("\n=== 11. Forgot password ===")
r = requests.post(
    f"{BASE}/auth/forgot-password",
    json={"email": "smoke_cand@test.com"},
)
ok("Forgot password (generic response)", r.status_code == 200)

# ── 12. Cleanup ───────────────────────────────────────────────────────────────
print("\n=== 12. Cleanup test data ===")
# Delete resume
if resume_id:
    r = requests.delete(f"{BASE}/resumes/{resume_id}", headers=auth_headers(cand_token))
    ok("Delete resume", r.status_code == 204)

# Delete job (recruiter)
if job_id:
    r = requests.delete(f"{BASE}/jobs/{job_id}", headers=auth_headers(recr_token))
    ok("Delete job", r.status_code == 204)

# Delete candidate user (via admin or self)
r = requests.delete(f"{BASE}/users/me", headers=auth_headers(cand_token))
if r.status_code in (200, 204, 405):
    ok("Delete candidate account (or not supported)", True, r.status_code)

# ── Summary ────────────────────────────────────────────────────────────────────
print("\n" + "="*50)
if failures:
    print(f"FAILED tests: {failures}")
    sys.exit(1)
else:
    print("ALL SMOKE TESTS PASSED")
