import os
import tempfile
import pytest
from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine
from app.db.database import Base
import app.db.models


def test_alembic_migrations_on_clean_db():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
        tmp_db = os.path.join(tmp_dir, "clean_test.db")
        alembic_ini = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        cfg = Config(alembic_ini)
        cfg.set_main_option("sqlalchemy.url", f"sqlite:///{tmp_db}")
        
        # Upgrades cleanly to head from scratch
        command.upgrade(cfg, "head")


def test_alembic_migrations_on_existing_schema():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
        tmp_db = os.path.join(tmp_dir, "existing_test.db")
        eng = create_engine(f"sqlite:///{tmp_db}")
        Base.metadata.create_all(bind=eng)
        eng.dispose()

        alembic_ini = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        cfg = Config(alembic_ini)
        cfg.set_main_option("sqlalchemy.url", f"sqlite:///{tmp_db}")
        
        # Upgrades cleanly to head even if tables and indexes already exist
        command.upgrade(cfg, "head")
