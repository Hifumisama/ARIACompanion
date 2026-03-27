from __future__ import annotations

import uuid
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase


# ---------------------------------------------------------------------------
# SQLAlchemy ORM
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


class CharacterRow(Base):
    __tablename__ = "characters"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    universe = Column(String, nullable=False, default="")
    role = Column(String, nullable=False, default="")
    language = Column(String, nullable=False, default="fr")
    backstory = Column(Text, nullable=False, default="")
    avatar_base64 = Column(Text, nullable=True)
    # Complex nested fields stored as JSON text
    personality_axes = Column(Text, nullable=False, default="[]")
    emotional_modes = Column(Text, nullable=False, default="[]")
    triggers = Column(Text, nullable=False, default="[]")
    speech_style = Column(Text, nullable=False, default='{"register":"","languageNotes":""}')
    constraints = Column(Text, nullable=False, default="[]")
    relationships = Column(Text, nullable=False, default="[]")
    output_fields = Column(Text, nullable=False, default="[]")
    created_at = Column(Float, nullable=False)
    updated_at = Column(Float, nullable=False)


# ---------------------------------------------------------------------------
# Pydantic schemas (mirror TypeScript CharacterDefinition)
# ---------------------------------------------------------------------------

class PersonalityAxis(BaseModel):
    name: str
    value: int  # 0-100


class EmotionalMode(BaseModel):
    name: str
    description: str
    isDefault: bool = False


class Trigger(BaseModel):
    condition: str
    fromMode: str  # nom du mode ou '*'
    toMode: str


class SpeechStyle(BaseModel):
    register: str = ""
    languageNotes: str = ""


class Constraint(BaseModel):
    description: str


class RelationshipStance(BaseModel):
    interlocutorType: str
    attitude: str


class OutputFieldDefinition(BaseModel):
    name: str
    type: str  # "string" | "number" | "enum"
    enumValues: list[str] = []
    description: str = ""
    required: bool = True


class CharacterCreate(BaseModel):
    """Schema for creating a character (id auto-generated if missing)."""
    id: Optional[str] = None
    name: str
    universe: str = ""
    role: str = ""
    language: str = "fr"
    backstory: str = ""
    avatarBase64: Optional[str] = None
    personalityAxes: list[PersonalityAxis] = []
    emotionalModes: list[EmotionalMode] = []
    triggers: list[Trigger] = []
    speechStyle: SpeechStyle = Field(default_factory=SpeechStyle)
    constraints: list[Constraint] = []
    relationships: list[RelationshipStance] = []
    outputFields: list[OutputFieldDefinition] = []
    createdAt: Optional[float] = None
    updatedAt: Optional[float] = None


class CharacterResponse(BaseModel):
    """Schema for character API responses."""
    id: str
    name: str
    universe: str
    role: str
    language: str
    backstory: str
    avatarBase64: Optional[str] = None
    personalityAxes: list[PersonalityAxis]
    emotionalModes: list[EmotionalMode]
    triggers: list[Trigger]
    speechStyle: SpeechStyle
    constraints: list[Constraint]
    relationships: list[RelationshipStance]
    outputFields: list[OutputFieldDefinition]
    createdAt: float
    updatedAt: float
