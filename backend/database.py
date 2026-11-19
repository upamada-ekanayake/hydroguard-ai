"""Supabase database connection for HydroGuard AI.

Reads credentials from backend/.env:
    SUPABASE_URL=...   # https://<project-ref>.supabase.co
    SUPABASE_KEY=...   # anon/public key (for the Supabase client library)
    DATABASE_URL=...   # postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
"""

import os

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    """Open a new connection to the Supabase Postgres database."""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set in backend/.env")
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def fetch_all(query: str, params: tuple | None = None) -> list[dict]:
    """Run a SELECT and return all rows as dicts."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()
    finally:
        conn.close()


def execute(query: str, params: tuple | None = None) -> None:
    """Run a write statement (CREATE / INSERT / UPDATE / DELETE) and commit."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
        conn.commit()
    finally:
        conn.close()
