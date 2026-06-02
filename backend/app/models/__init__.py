# Import every ORM model so SQLAlchemy's mapper registry is fully populated
# before any session is used. Both the FastAPI app and standalone scripts
# (e.g. scripts/make_admin.py) can rely on this package import.
from app.models import user, resume, job, notification, question_history  # noqa: F401
