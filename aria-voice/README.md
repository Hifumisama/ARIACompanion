# aria-voice

Service de traitement vocal (STT + TTS) pour ARIACompanion.

## Description

Ce module combine la reconnaissance vocale (Speech-to-Text) et la synthèse vocale (Text-to-Speech) dans un seul service FastAPI. Il est appelé par `aria-orchestrator` pour convertir l'audio utilisateur en texte et les réponses textuelles en audio.

## Architecture

```
aria-voice/
  main.py             # FastAPI (endpoints STT + TTS)
  config.py           # Configuration via variables d'environnement
  services/
    stt.py            # Whisper (faster-whisper) - reconnaissance vocale
    tts.py            # Piper TTS - synthèse vocale
  models/
    piper/            # Modèle Piper (.onnx + .onnx.json)
    whisper/          # Cache modèle Whisper
```

## API

Documentation interactive disponible sur `/docs` (Swagger UI) et `/redoc`.

### STT - Speech-to-Text

```
POST /stt
Content-Type: multipart/form-data

Body: file (audio file - WAV, WebM, etc.)

Response: {"text": "texte transcrit"}
```

### TTS - Text-to-Speech

```
POST /tts
Content-Type: application/json

Body: {"text": "texte à synthétiser"}

Response: audio/wav (binary)
```

### Health Check

```
GET /health

Response: {"status": "ok", "service": "aria-voice"}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL` | `small` | Taille du modèle Whisper (`tiny`, `base`, `small`, `medium`, `large`) |
| `WHISPER_LANGUAGE` | `fr` | Langue de transcription |
| `WHISPER_MODEL_DIR` | `/app/models/whisper` | Répertoire de cache des modèles Whisper |
| `PIPER_MODEL_PATH` | `/app/models/piper/model.onnx` | Chemin du modèle Piper |
| `PIPER_CONFIG_PATH` | `/app/models/piper/model.onnx.json` | Chemin de la config Piper |

## Modèles supportés

### STT (Whisper)

Utilise [faster-whisper](https://github.com/SYSTRAN/faster-whisper) avec inference CPU en int8. Le modèle est téléchargé automatiquement au premier appel.

| Modèle | Taille | Précision | Vitesse |
|--------|--------|-----------|---------|
| `tiny` | 39M | Faible | Très rapide |
| `base` | 74M | Correcte | Rapide |
| `small` | 244M | Bonne | Moyenne |
| `medium` | 769M | Très bonne | Lente |
| `large` | 1.5G | Excellente | Très lente |

### TTS (Piper)

Utilise [Piper](https://github.com/rhasspy/piper) pour la synthèse vocale locale. Le modèle doit être fourni manuellement dans `models/piper/`.

## Port

| Port | Protocole | Description |
|------|-----------|-------------|
| 8000 (interne) | HTTP | API STT + TTS |
| 8001 (hôte) | HTTP | Port exposé via docker-compose |
