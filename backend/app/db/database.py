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
            # questions table
            res = conn.execute(text("PRAGMA table_info(questions);")).fetchall()
            q_cols = {row[1] for row in res}
            if q_cols:
                if "followup_question" not in q_cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN followup_question TEXT;"))
                if "followup_answer" not in q_cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN followup_answer TEXT;"))

            # sessions table
            res_sess = conn.execute(text("PRAGMA table_info(sessions);")).fetchall()
            s_cols = {row[1] for row in res_sess}
            if s_cols:
                if "awaiting_followup" not in s_cols:
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN awaiting_followup BOOLEAN DEFAULT 0;"))
                if "active_followup_id" not in s_cols:
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN active_followup_id TEXT;"))

            # users table
            res_users = conn.execute(text("PRAGMA table_info(users);")).fetchall()
            u_cols = {row[1] for row in res_users}
            if u_cols:
                if "password_hash" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN password_hash TEXT;"))
                if "account_status" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active';"))

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
