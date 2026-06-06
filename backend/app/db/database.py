from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=2,        # 2 resident connections; single uvicorn worker can have
                            # upload + post-LLM write + regular endpoint in flight
        max_overflow=4,     # burst headroom; total cap = 6
        pool_timeout=20,    # fail fast before Render's proxy timeout (~60 s)
        pool_recycle=300,   # proactively retire before Neon's 5-min idle cutoff
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
