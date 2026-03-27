import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import (
    CharacterRow,
    EmotionalMode,
    OutputFieldDefinition,
    PersonalityAxis,
    Constraint,
    RelationshipStance,
    SpeechStyle,
    Trigger,
)

router = APIRouter(prefix="/api/characters", tags=["Prompts"])


def _get_all_output_fields(
    emotional_modes: list[EmotionalMode],
    output_fields: list[OutputFieldDefinition],
) -> list[OutputFieldDefinition]:
    """Auto-derive tone from emotional modes + user-defined fields."""
    fields: list[OutputFieldDefinition] = []

    mode_names = [m.name.strip() for m in emotional_modes if m.name.strip()]
    if mode_names:
        fields.append(OutputFieldDefinition(
            name="tone",
            type="enum",
            enumValues=mode_names,
            description="Le ton émotionnel de la réponse",
            required=True,
        ))

    for f in output_fields:
        if f.name.lower() != "tone":
            fields.append(f)

    return fields


def _build_output_format_description(fields: list[OutputFieldDefinition]) -> str:
    lines = []
    for f in fields:
        desc = f'- "{f.name}"'
        desc += " (obligatoire)" if f.required else " (optionnel)"
        if f.type == "enum" and f.enumValues:
            desc += f": un parmi [{', '.join(f.enumValues)}]"
        if f.description.strip():
            desc += f" — {f.description}"
        lines.append(desc)
    return "\n".join(lines)


def _generate_system_prompt(
    name: str,
    role: str,
    universe: str,
    language: str,
    backstory: str,
    personality_axes: list[PersonalityAxis],
    emotional_modes: list[EmotionalMode],
    triggers: list[Trigger],
    speech_style: SpeechStyle,
    constraints: list[Constraint],
    relationships: list[RelationshipStance],
    output_fields: list[OutputFieldDefinition],
) -> str:
    """Port of generateSystemPromptFromCharacter from characterPrompt.ts."""
    sections: list[str] = []

    # Identity
    sections.append(
        f"Tu es {name}, {role} dans l'univers de {universe}. "
        f"Tu t'exprimes en {language or 'Francais'}."
    )

    if backstory.strip():
        sections.append(f"## Identité\n{backstory}")

    # Personality
    if personality_axes:
        axes = "\n".join(f"- {a.name}: {a.value}/100" for a in personality_axes)
        sections.append(f"## Personnalité\n{axes}")

    # Emotional modes
    if emotional_modes:
        modes = "\n".join(
            f"- {m.name}{' (défaut)' if m.isDefault else ''}: {m.description}"
            for m in emotional_modes
        )
        sections.append(f"## Modes émotionnels\n{modes}")

    # Triggers
    if triggers:
        trigger_lines = []
        for t in triggers:
            from_label = "n'importe quel mode" if t.fromMode == "*" else f"mode {t.fromMode}"
            trigger_lines.append(f"- Quand {t.condition}: passe de {from_label} à mode {t.toMode}")
        sections.append(f"## Déclencheurs\n" + "\n".join(trigger_lines))

    # Speech style
    style_parts: list[str] = []
    if speech_style.register.strip():
        style_parts.append(f"Registre: {speech_style.register}")
    if speech_style.languageNotes.strip():
        style_parts.append(f"Notes: {speech_style.languageNotes}")
    if style_parts:
        sections.append(f"## Style de parole\n" + "\n".join(style_parts))

    # Constraints
    if constraints:
        constraint_lines = "\n".join(f"- {c.description}" for c in constraints)
        sections.append(f"## Contraintes\n{constraint_lines}")

    # Relationships
    if relationships:
        rel_lines = "\n".join(
            f"- Face à {r.interlocutorType}: {r.attitude}" for r in relationships
        )
        sections.append(f"## Relations\n{rel_lines}")

    # Output format
    all_fields = _get_all_output_fields(emotional_modes, output_fields)
    sections.append(
        f"## Format de réponse\n"
        f'Tu réponds TOUJOURS en JSON valide avec la structure suivante dans "output":\n'
        f"{_build_output_format_description(all_fields)}"
    )

    return "\n\n".join(sections)


@router.get(
    "/{character_id}/system-prompt",
    summary="Générer le system prompt d'un personnage",
    response_description="System prompt texte",
)
async def get_system_prompt(character_id: str, session: AsyncSession = Depends(get_session)):
    row = await session.get(CharacterRow, character_id)
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")

    prompt = _generate_system_prompt(
        name=row.name,
        role=row.role,
        universe=row.universe,
        language=row.language,
        backstory=row.backstory,
        personality_axes=[PersonalityAxis(**a) for a in json.loads(row.personality_axes)],
        emotional_modes=[EmotionalMode(**m) for m in json.loads(row.emotional_modes)],
        triggers=[Trigger(**t) for t in json.loads(row.triggers)],
        speech_style=SpeechStyle(**json.loads(row.speech_style)),
        constraints=[Constraint(**c) for c in json.loads(row.constraints)],
        relationships=[RelationshipStance(**r) for r in json.loads(row.relationships)],
        output_fields=[OutputFieldDefinition(**f) for f in json.loads(row.output_fields)],
    )

    return {"prompt": prompt}
