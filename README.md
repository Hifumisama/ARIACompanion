# ARIA Companion

**Artificial Responsive Interactive Agent** — Un compagnon IA 100% local avec personnalité configurable, voix bidirectionnelle, et architecture modulaire.

## Architecture

```
                         ┌─────────────────────┐
                         │  aria-ui-frontend    │
                         │  (React + Vite)      │
                         │  :5173               │
                         └────────┬─────────────┘
                                  │ WebSocket
                         ┌────────▼─────────────┐
                         │  aria-orchestrator    │
                         │  (FastAPI)            │
                         │  :4545               │
                         └──┬──────┬──────┬─────┘
                            │      │      │
              HTTP /api/chat│      │      │ HTTP /stt, /tts
                            │      │      │
              ┌─────────────▼┐     │   ┌──▼──────────────┐
              │ aria-brain-  │     │   │  aria-voice      │
              │ models       │     │   │  (Whisper+Piper) │
              │ (Ollama)     │     │   │  :8001           │
              │ :11434       │     │   └─────────────────┘
              └──────────────┘     │
                                   │ HTTP /api/characters
                         ┌─────────▼───────────┐
                         │ aria-character-forge │
                         │ backend  :8002       │
                         │ frontend :5174       │
                         │ (SQLite)             │
                         └─────────────────────┘
```

7 conteneurs Docker sur un réseau `aria-net` :

| Service | Rôle | Port |
|---------|------|------|
| [aria-brain-models](aria-brain-models/) | LLM via Ollama | 11434 |
| [aria-voice](aria-voice/) | STT (Whisper) + TTS (Piper) | 8001 |
| [aria-character-forge](aria-character-forge/) | Gestion des personnages (backend + frontend) | 8002 / 5174 |
| [aria-orchestrator](aria-orchestrator/) | Coordinateur central (WebSocket + HTTP) | 4545 |
| [aria-ui-frontend](aria-ui-frontend/) | Interface chat React | 5173 |

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) et Docker Compose v2
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) (pour le GPU)

## Démarrage rapide

```bash
git clone <repo-url>
cd ARIACompanion

# Configurer les variables d'environnement
cp .env.example .env

# Lancer tous les services
docker compose up --build
```

Interfaces disponibles :
- **Chat** : http://localhost:5173
- **Character Forge** : http://localhost:5174
- **Swagger Orchestrator** : http://localhost:4545/docs
- **Swagger Voice** : http://localhost:8001/docs
- **Swagger Character Forge** : http://localhost:8002/docs

## Voix TTS (Piper)

Placer les fichiers `.onnx` et `.onnx.json` dans `aria-voice/models/piper/` :

```bash
cd aria-voice/models/piper

# Voix française (siwis, qualité medium)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json

mv fr_FR-siwis-medium.onnx model.onnx
mv fr_FR-siwis-medium.onnx.json model.onnx.json
```

> Catalogue complet : https://huggingface.co/rhasspy/piper-voices

## Configuration

Variables d'environnement principales (fichier `.env`) :

```env
# Modèle LLM (Ollama)
OLLAMA_MODEL=llama3.2          # Modèle à télécharger au démarrage
OLLAMA_PORT=11434

# Personnage actif
ACTIVE_CHARACTER_ID=            # ID du personnage (vide = prompt par défaut)

# Ports
ORCHESTRATOR_PORT=4545
FRONTEND_PORT=5173
VOICE_PORT=8001
FORGE_BACKEND_PORT=8002
FORGE_FRONTEND_PORT=5174

# STT
WHISPER_MODEL=small             # tiny|base|small|medium|large-v3
WHISPER_LANGUAGE=fr

# TTS
TTS_CHUNK_SIZE=16384

# Interruption
INTERRUPTION_KEYWORDS=stop,arrête,tais-toi
```

## Modules

| Module | Description | Documentation |
|--------|-------------|---------------|
| `aria-brain-models` | Instance Ollama pour l'inférence LLM | [README](aria-brain-models/README.md) |
| `aria-voice` | STT (faster-whisper) + TTS (piper-tts) | [README](aria-voice/README.md) |
| `aria-character-forge` | Création de personnages + backend SQLite | [README](aria-character-forge/README.md) |
| `aria-orchestrator` | Coordinateur WebSocket + HTTP | [README](aria-orchestrator/README.md) |
| `aria-ui-frontend` | Interface chat React | [README](aria-ui-frontend/README.md) |

## Stack technique

| Couche | Technologie |
|--------|-------------|
| LLM | Ollama |
| STT | faster-whisper (CPU, int8) |
| TTS | piper-tts (ONNX) |
| Backend | FastAPI (Python 3.11) |
| Base de données | SQLite (aiosqlite) |
| Frontend | React 19 + Vite + TypeScript |
| Infra | Docker Compose |
