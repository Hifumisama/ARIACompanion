import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/characters.db")
DATABASE_DIR = os.getenv("DATABASE_DIR", "./data")
