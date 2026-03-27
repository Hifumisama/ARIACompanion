import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models import Base
from routers import characters, prompts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aria.character-forge")

app = FastAPI(
    title="ARIA Character Forge",
    description="Backend de gestion des personnages pour ARIACompanion. "
                "Fournit le CRUD personnages, l'export/import, et la génération de system prompts.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(characters.router)
app.include_router(prompts.router)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialized")


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "aria-character-forge"}
