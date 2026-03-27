# aria-orchestrator

Coordinateur central d'ARIACompanion.

## Description

Service léger qui coordonne les appels entre le frontend et les services backend (LLM, STT/TTS, personnages). Il gère les connexions WebSocket, le streaming de tokens, et le flux audio.

Aucun modèle ML n'est embarqué : tous les traitements sont délégués via HTTP aux services spécialisés.

## Architecture

```
aria-orchestrator/
  main.py             # FastAPI + WebSocket
  pipeline.py         # Coordination LLM (streaming + parsing)
  config.py           # Configuration des URLs de services
  services/
    brain.py          # Client HTTP vers Ollama (LLM)
    voice.py          # Client HTTP vers aria-voice (STT/TTS)
    character.py      # Client HTTP vers aria-character-forge
    interruption.py   # Détection de mots-clés d'interruption
```

## API

Documentation interactive disponible sur `/docs` (Swagger UI) et `/redoc`.

### REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/reload-prompt` | Recharger le system prompt depuis character-forge |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `WS /ws` | Canal principal de communication avec le frontend |

## Protocole WebSocket

### Client -> Serveur

| Type | Payload | Description |
|------|---------|-------------|
| `message` | `{"type": "message", "content": "..."}` | Message texte utilisateur |
| `audio` | `{"type": "audio", "format": "wav"}` + frame binaire | Audio utilisateur (suivi des bytes) |
| `interrupt` | `{"type": "interrupt", "reason": "..."}` | Interrompre la génération |
| `control` | `{"type": "control", "action": "tts_enable\|tts_disable"}` | Activer/désactiver le TTS |

### Serveur -> Client

| Type | Payload | Description |
|------|---------|-------------|
| `status` | `{"type": "status", "status": "thinking\|streaming"}` | État du pipeline |
| `token` | `{"type": "token", "text": "...", "seq": N}` | Token streamé |
| `response` | `{"type": "response", "text": "...", "emotion": "...", "tone": "..."}` | Réponse complète |
| `stt_result` | `{"type": "stt_result", "text": "..."}` | Transcription audio |
| `tts_start` | `{"type": "tts_start", "request_id": "..."}` | Début stream audio TTS |
| `tts_end` | `{"type": "tts_end", "request_id": "..."}` | Fin stream audio TTS |
| `interrupted` | `{"type": "interrupted", "reason": "..."}` | Génération interrompue |
| `error` | `{"type": "error", "message": "..."}` | Erreur |

Entre `tts_start` et `tts_end`, des frames binaires WAV sont envoyées.

## Flux de données

```
1. Frontend ──WS──> {"type":"message","content":"Salut"}
2. Orchestrator ──HTTP──> Ollama /api/chat (stream: true)
3. Ollama renvoie tokens NDJSON
4. pipeline.py extrait le champ "text" du JSON en streaming
5. Orchestrator ──WS──> {"type":"token","text":"..."} (au fur et à mesure)
6. Stream fini -> parse JSON complet pour emotion/tone
7. Orchestrator ──WS──> {"type":"response",...}
8. Si TTS activé :
   Orchestrator ──HTTP──> aria-voice /tts (texte -> WAV)
   Orchestrator ──WS──> tts_start + chunks binaires + tts_end
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BRAIN_URL` | `http://aria-brain-models:11434` | URL Ollama |
| `VOICE_URL` | `http://aria-voice:8000` | URL aria-voice |
| `CHARACTER_FORGE_URL` | `http://aria-character-forge-backend:8000` | URL character-forge |
| `ACTIVE_CHARACTER_ID` | `` | ID du personnage actif (vide = prompt par défaut) |
| `TTS_CHUNK_SIZE` | `16384` | Taille des chunks audio WebSocket (bytes) |
| `INTERRUPTION_KEYWORDS` | `stop,arrête,tais-toi` | Mots-clés d'interruption vocale |

## Port

| Port | Protocole | Description |
|------|-----------|-------------|
| 8000 (interne) | HTTP + WS | API REST + WebSocket |
| 4545 (hôte) | HTTP + WS | Port exposé via docker-compose |
