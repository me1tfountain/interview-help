import os
import sys

# Fix Windows encoding issue
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from app.database import engine, Base
from app.routers import auth, sessions

load_dotenv(encoding='utf-8')

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Create tables
        print("[*] Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("[OK] Database tables created successfully")
    except Exception as e:
        print(f"[FAIL] Database initialization failed: {e}")
        print("Check:")
        print("1. Is PostgreSQL service running?")
        print("2. Are database connection details correct?")
        print("3. Is the password 'root'?")
        raise e

    yield

app = FastAPI(
    title="AI Interview Helper API",
    description="Backend API for AI Interview Helper application",
    version="0.3.0",
    lifespan=lifespan
)

# CORS middleware
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])

@app.get("/")
async def root():
    return {"message": "AI Interview Helper API v0.3.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}