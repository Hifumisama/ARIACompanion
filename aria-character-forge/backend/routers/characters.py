import json
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import CharacterCreate, CharacterResponse, CharacterRow

router = APIRouter(prefix="/api/characters", tags=["Characters"])


def _row_to_response(row: CharacterRow) -> CharacterResponse:
    """Convert a DB row to a Pydantic response."""
    return CharacterResponse(
        id=row.id,
        name=row.name,
        universe=row.universe,
        role=row.role,
        language=row.language,
        backstory=row.backstory,
        avatarBase64=row.avatar_base64,
        personalityAxes=json.loads(row.personality_axes),
        emotionalModes=json.loads(row.emotional_modes),
        triggers=json.loads(row.triggers),
        speechStyle=json.loads(row.speech_style),
        constraints=json.loads(row.constraints),
        relationships=json.loads(row.relationships),
        outputFields=json.loads(row.output_fields),
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def _create_to_row(data: CharacterCreate) -> CharacterRow:
    """Convert a Pydantic create schema to a DB row."""
    now = time.time() * 1000  # ms timestamp like JS Date.now()
    return CharacterRow(
        id=data.id or str(uuid.uuid4()),
        name=data.name,
        universe=data.universe,
        role=data.role,
        language=data.language,
        backstory=data.backstory,
        avatar_base64=data.avatarBase64,
        personality_axes=json.dumps([a.model_dump() for a in data.personalityAxes]),
        emotional_modes=json.dumps([m.model_dump() for m in data.emotionalModes]),
        triggers=json.dumps([t.model_dump() for t in data.triggers]),
        speech_style=json.dumps(data.speechStyle.model_dump()),
        constraints=json.dumps([c.model_dump() for c in data.constraints]),
        relationships=json.dumps([r.model_dump() for r in data.relationships]),
        output_fields=json.dumps([f.model_dump() for f in data.outputFields]),
        created_at=data.createdAt or now,
        updated_at=data.updatedAt or now,
    )


@router.get("", response_model=list[CharacterResponse], summary="Lister tous les personnages")
async def list_characters(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(CharacterRow))
    rows = result.scalars().all()
    return [_row_to_response(r) for r in rows]


@router.get("/{character_id}", response_model=CharacterResponse, summary="Obtenir un personnage")
async def get_character(character_id: str, session: AsyncSession = Depends(get_session)):
    row = await session.get(CharacterRow, character_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    return _row_to_response(row)


@router.post("", response_model=CharacterResponse, status_code=201, summary="Créer un personnage")
async def create_character(data: CharacterCreate, session: AsyncSession = Depends(get_session)):
    row = _create_to_row(data)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _row_to_response(row)


@router.put("/{character_id}", response_model=CharacterResponse, summary="Mettre à jour un personnage")
async def update_character(character_id: str, data: CharacterCreate, session: AsyncSession = Depends(get_session)):
    row = await session.get(CharacterRow, character_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")

    now = time.time() * 1000
    row.name = data.name
    row.universe = data.universe
    row.role = data.role
    row.language = data.language
    row.backstory = data.backstory
    row.avatar_base64 = data.avatarBase64
    row.personality_axes = json.dumps([a.model_dump() for a in data.personalityAxes])
    row.emotional_modes = json.dumps([m.model_dump() for m in data.emotionalModes])
    row.triggers = json.dumps([t.model_dump() for t in data.triggers])
    row.speech_style = json.dumps(data.speechStyle.model_dump())
    row.constraints = json.dumps([c.model_dump() for c in data.constraints])
    row.relationships = json.dumps([r.model_dump() for r in data.relationships])
    row.output_fields = json.dumps([f.model_dump() for f in data.outputFields])
    row.updated_at = now

    await session.commit()
    await session.refresh(row)
    return _row_to_response(row)


@router.delete("/{character_id}", summary="Supprimer un personnage")
async def delete_character(character_id: str, session: AsyncSession = Depends(get_session)):
    row = await session.get(CharacterRow, character_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    await session.delete(row)
    await session.commit()
    return {"status": "deleted", "id": character_id}


@router.get("/{character_id}/export", summary="Exporter un personnage en JSON")
async def export_character(character_id: str, session: AsyncSession = Depends(get_session)):
    row = await session.get(CharacterRow, character_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")
    char = _row_to_response(row)
    return JSONResponse(
        content=char.model_dump(),
        headers={"Content-Disposition": f'attachment; filename="{char.name}.json"'},
    )


@router.post("/import", response_model=CharacterResponse, status_code=201, summary="Importer un personnage depuis JSON")
async def import_character(file: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
    content = await file.read()
    try:
        data_dict = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    data = CharacterCreate(**data_dict)
    # Generate a new ID to avoid conflicts
    data.id = str(uuid.uuid4())
    row = _create_to_row(data)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _row_to_response(row)
