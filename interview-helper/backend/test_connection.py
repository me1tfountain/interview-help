#!/usr/bin/env python3
"""
Database connection test script - Windows compatible
"""

import os
import sys
import psycopg
from urllib.parse import urlparse

# Fix encoding for Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def test_direct_connection():
    """Test direct PostgreSQL connection"""
    try:
        print("[*] Testing direct PostgreSQL connection...")

        # Connect to default database first
        conn = psycopg.connect(
            host="localhost",
            port=5432,
            dbname="postgres",
            user="postgres",
            password="root"
        )

        conn.autocommit = True  # Set before any query in psycopg3

        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"[OK] PostgreSQL version: {version[0]}")

        # Check if target database exists (autocommit=True so no transaction)
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = 'ai_interview_helper';")
        db_exists = cursor.fetchone()

        if not db_exists:
            print("[*] Creating target database...")
            cursor.execute("CREATE DATABASE ai_interview_helper;")
            print("[OK] Database created successfully")
        else:
            print("[OK] Target database already exists")

        cursor.close()
        conn.close()

        # Test connection to target database
        print("[*] Testing connection to target database...")
        conn = psycopg.connect(
            host="localhost",
            port=5432,
            dbname="ai_interview_helper",
            user="postgres",
            password="root"
        )

        cursor = conn.cursor()
        cursor.execute("SELECT 1;")
        result = cursor.fetchone()
        print("[OK] Target database connection successful")

        cursor.close()
        conn.close()

        return True

    except psycopg.Error as e:
        print(f"[FAIL] PostgreSQL connection error: {e}")
        return False
    except Exception as e:
        print(f"[FAIL] Other error: {e}")
        return False

def test_sqlalchemy_connection():
    """Test SQLAlchemy connection"""
    try:
        print("[*] Testing SQLAlchemy connection...")

        from dotenv import load_dotenv
        load_dotenv(encoding='utf-8')

        from sqlalchemy import create_engine, text

        db_url = os.getenv("DATABASE_URL", "postgresql://postgres:root@localhost:5432/ai_interview_helper")
        print(f"  Database URL: {db_url}")

        engine = create_engine(db_url)

        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            print("[OK] SQLAlchemy connection successful")
            return True

    except Exception as e:
        print(f"[FAIL] SQLAlchemy connection failed: {e}")
        return False

def main():
    print("=" * 50)
    print("  Database Connection Test")
    print("=" * 50)

    # Check psycopg availability
    try:
        import psycopg
        print("[OK] psycopg module available")
    except ImportError:
        print("[FAIL] psycopg module not installed")
        print("  Run: pip install psycopg[binary]")
        return False

    # Direct connection test
    if not test_direct_connection():
        print("\n[!] Direct connection failed. Possible causes:")
        print("  1. PostgreSQL service not started")
        print("  2. Incorrect password (should be 'root')")
        print("  3. Port 5432 is occupied or unreachable")
        print("  4. Firewall blocking the connection")
        return False

    # SQLAlchemy connection test
    if not test_sqlalchemy_connection():
        print("[FAIL] SQLAlchemy connection failed")
        return False

    print("\n[SUCCESS] All tests passed! Database connection is working.")
    return True

if __name__ == "__main__":
    if main():
        print("\n[*] Safe to start the backend server.")
    else:
        print("\n[!] Please resolve database connection issues first.")
