# aria-character-forge

Module de création et gestion des personnages pour ARIACompanion.

## Description

Ce module permet de créer, éditer, tester et exporter des personnages IA avec des personnalités complexes. Il se compose de :

- **Backend** : API FastAPI + SQLite pour le stockage persistant des personnages
- **Frontend** : Application React pour l'édition visuelle des personnages et la génération de datasets

## Architecture

```
aria-character-forge/
  backend/
    main.py             # FastAPI app
    models.py           # Pydantic + SQLAlchemy models
    database.py         # SQLite async setup
    config.py           # Configuration
    routers/
      characters.py     # CRUD endpoints
      prompts.py        # System prompt generation
  frontend/
    src/
      components/       # React components (Hub, Builder, Playground, etc.)
      services/
        storage.ts      # API client (anciennement localStorage)
        ollama.ts       # Client Ollama pour chat et génération
        characterPrompt.ts  # Génération de system prompts côté client
```

## API Backend

Documentation interactive disponible sur `/docs` (Swagger UI) et `/redoc`.

### Characters (CRUD)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/characters` | Lister tous les personnages |
| `GET` | `/api/characters/{id}` | Obtenir un personnage |
| `POST` | `/api/characters` | Créer un personnage |
| `PUT` | `/api/characters/{id}` | Mettre à jour un personnage |
| `DELETE` | `/api/characters/{id}` | Supprimer un personnage |
| `GET` | `/api/characters/{id}/export` | Exporter en JSON |
| `POST` | `/api/characters/import` | Importer depuis un fichier JSON |

### Prompts

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/characters/{id}/system-prompt` | Générer le system prompt |

### Health

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/health` | Health check |

## Schéma de données

### CharacterDefinition

```json
{
  "id": "uuid",
  "name": "Hadès",
  "universe": "Mythologie grecque",
  "role": "Dieu des Enfers",
  "language": "fr",
  "backstory": "...",
  "avatarBase64": "data:image/...",
  "personalityAxes": [
    { "name": "Cynisme", "value": 90 }
  ],
  "emotionalModes": [
    { "name": "sarcastic", "description": "...", "isDefault": true }
  ],
  "triggers": [
    { "condition": "mention Hercule", "fromMode": "*", "toMode": "furious" }
  ],
  "speechStyle": {
    "register": "soutenu",
    "languageNotes": "..."
  },
  "constraints": [
    { "description": "Ne jamais briser le 4ème mur" }
  ],
  "relationships": [
    { "interlocutorType": "Âme perdue", "attitude": "condescendant" }
  ],
  "outputFields": [
    { "name": "text", "type": "string", "description": "Réponse", "required": true }
  ],
  "createdAt": 1711234567890,
  "updatedAt": 1711234567890
}
```

Les champs complexes (arrays/objects) sont stockés en JSON dans SQLite.

## Configuration

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/characters.db` | URL de la base de données |
| `DATABASE_DIR` | `./data` | Répertoire de la base de données |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8002` | URL du backend |
| `VITE_OLLAMA_URL` | `http://localhost:11434` | URL de l'instance Ollama |

## Ports

| Port | Service | Description |
|------|---------|-------------|
| 8000 (interne) / 8002 (hôte) | Backend | API FastAPI |
| 5174 (hôte) | Frontend | App React (Vite dev server) |
