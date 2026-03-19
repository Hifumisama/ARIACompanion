# ARIA Companion

**Artificial Responsive Interactive Agent** — Un compagnon IA 100% local incarnant Hades, dieu des Enfers. Cynique, sarcastique, et amateur de contrats douteux.

## Architecture

```
Frontend (React/Vite)
  ├── WebSocket /ws ──────► Orchestrator (FastAPI)
  ├── POST /stt (audio) ──►   ├── faster-whisper (STT)
  └── POST /tts (texte) ──►   ├── piper-tts (TTS)
                               ├── memoire glissante (JSON)
                               └──► Brain (llama-server)
```

3 conteneurs Docker sur un reseau `aria-net` :
- **brain** — llama.cpp (`llama-server`) avec modele GGUF
- **orchestrator** — FastAPI + WebSocket + STT (faster-whisper) + TTS (piper)
- **frontend** — React 19 + Vite + TypeScript, UI de chat avec audio

## Installation

### 1. Cloner et configurer

```bash
git clone <repo-url>
cd ARIACompanion
cp .env.example .env
```

### 2. Telecharger un modele LLM (format GGUF)

Placer un fichier `.gguf` dans `brain/models/` :

```bash
# Exemple avec Gemma 2 2B (quantise Q4_K_M, ~1.5 Go)
huggingface-cli download bartowski/gemma-2-2b-it-GGUF \
  --include "gemma-2-2b-it-Q4_K_M.gguf" \
  --local-dir brain/models/

mv brain/models/gemma-2-2b-it-Q4_K_M.gguf brain/models/model.gguf
```

> N'importe quel modele GGUF compatible llama.cpp fonctionne.
> Adapter `MODEL_FILE` dans `.env` si le nom du fichier est different.

### 3. Telecharger une voix Piper (TTS)

Placer les fichiers `.onnx` et `.onnx.json` dans `models/piper/` :

```bash
cd models/piper

# Voix francaise (siwis, qualite medium)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json

mv fr_FR-siwis-medium.onnx model.onnx
mv fr_FR-siwis-medium.onnx.json model.onnx.json

cd ../..
```

> Catalogue complet des voix : https://huggingface.co/rhasspy/piper-voices

### 4. Modele Whisper (STT)

Telecharge automatiquement au premier lancement. Par defaut : modele `small` (~460 Mo).

Configurable via `WHISPER_MODEL` dans `.env` :
- `tiny` (~75 Mo) — rapide, qualite basique
- `base` (~140 Mo) — bon compromis vitesse/qualite
- `small` (~460 Mo) — recommande pour le francais
- `medium` (~1.5 Go) — meilleure qualite, plus lent

### 5. Lancer

```bash
docker compose up --build
```

Ouvrir **http://localhost:5173**

## Configuration

Toutes les variables sont dans `.env` :

```env
# Ports
ORCHESTRATOR_PORT=4545    # API + WebSocket
BRAIN_PORT=8080           # llama-server
FRONTEND_PORT=5173        # Interface web

# LLM (llama.cpp)
MODEL_FILE=model.gguf     # Fichier dans brain/models/
GPU_LAYERS=0              # 0 = CPU only, 99 = tout sur GPU
CONTEXT_SIZE=4096         # Taille de la fenetre de contexte
THREADS=4                 # Threads CPU

# Memoire
SUMMARY_INTERVAL=10       # Resume automatique tous les N messages

# STT
WHISPER_MODEL=small       # tiny|base|small|medium|large-v3
WHISPER_LANGUAGE=fr
```

## Utilisation

- **Texte** : taper dans la barre de saisie et envoyer
- **Voix** : cliquer sur MIC, parler, re-cliquer pour envoyer
- **VOX/MUTE** : activer/couper la synthese vocale des reponses
- **Purge** : effacer toute la memoire conversationnelle

## Structure du projet

```
ARIACompanion/
├── brain/
│   ├── models/           # Modeles GGUF (gitignore)
│   ├── prompts/aria.txt  # System prompt de Hades
│   ├── Dockerfile        # llama-server
│   └── entrypoint.sh
├── orchestrator/
│   ├── services/
│   │   ├── brain.py      # Client LLM (OpenAI API)
│   │   ├── memory.py     # Memoire glissante (JSON)
│   │   ├── stt.py        # Speech-to-Text (faster-whisper)
│   │   └── tts.py        # Text-to-Speech (piper)
│   ├── pipeline.py       # Pipeline de traitement
│   ├── main.py           # FastAPI + WebSocket
│   └── config.py
├── frontend/
│   └── src/
│       ├── components/Chat.tsx
│       └── hooks/
│           ├── useWebSocket.ts
│           ├── useAudioRecording.ts
│           └── useAudioPlayback.ts
├── models/
│   └── piper/            # Voix Piper (gitignore)
├── dataset-generator/    # Outil de generation de datasets
├── docker-compose.yml
└── .env
```

---

## Roadmap

### v0.1 — Le cerveau qui parle (texte)
- Orchestrator FastAPI + llama.cpp + memoire glissante + React chat
- System prompt "Hades" + reponses JSON (text + emotion + tone)
- Resume automatique de la conversation

### v0.2 — La voix `<-- ON EST ICI`
- STT (faster-whisper) — speech-to-text local sur CPU
- TTS (piper) — text-to-speech avec voix configurable
- Pipeline : audio → texte → brain → texte → audio

### v0.3 — L'interaction naturelle
- Full-duplex WebSocket streaming (parler et ecouter en meme temps)
- VAD (Voice Activity Detection) — detecter quand l'utilisateur parle
- Interruption par mot-cle ou en parlant par-dessus

### v0.4 — La personnalite
- Construction d'un dataset LoRA pour le roleplay Hades
- Fine-tuning avec adaptateur LoRA (chargeable dans llama.cpp)
- Enrichissement du format emotions

### v0.5 — L'avatar
- Affichage d'un avatar 2D/3D anime dans le frontend
- Animations basees sur le JSON emotion/tone
- Synchronisation levres avec le TTS

---

## Stack technique

| Couche | Techno |
|---|---|
| LLM | llama.cpp (llama-server) |
| STT | faster-whisper (CPU, int8) |
| TTS | piper-tts (ONNX) |
| Memoire | Resume glissant (JSON) |
| Backend | FastAPI (Python 3.11) |
| Frontend | React 19 + Vite + TypeScript |
| Infra | Docker Compose |
