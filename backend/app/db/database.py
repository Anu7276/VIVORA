from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def ensure_schema_migrations():
    """Lightweight SQLite migration to ensure newly added columns exist."""
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            res = conn.execute(text("PRAGMA table_info(questions);")).fetchall()
            existing_cols = {row[1] for row in res}
            if existing_cols:
                if "followup_question" not in existing_cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN followup_question TEXT;"))
                if "followup_answer" not in existing_cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN followup_answer TEXT;"))
                conn.commit()
    except Exception:
        pass

ensure_schema_migrations()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
