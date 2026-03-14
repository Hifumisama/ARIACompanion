# ARIA Companion

**Artificial Responsive Interactive Agent** — Un compagnon IA 100% local, avec la personnalité d'une badass bienveillante inspirée d'Ellen Ripley.

## Architecture

```
Frontend (React/Vite) <──WebSocket──> Orchestrator (FastAPI) ──> Ollama (Gemma 3 1B)
                                            │
                                            v
                                      Memory (ChromaDB)
```

4 conteneurs Docker sur un réseau `aria-net` :
- **brain** — Ollama + modèle Gemma 3 1B instruct
- **memory** — ChromaDB avec wrapper FastAPI (mémoire court/long terme)
- **orchestrator** — FastAPI + WebSocket, pipeline de traitement des messages
- **frontend** — React + Vite + TypeScript, UI de chat minimaliste

## Quickstart

```bash
# Cloner et lancer
cd ARIACompanion
docker compose up --build
```

Premier lancement : ~5 min (téléchargement du modèle ~800 MB).
Puis ouvrir **http://localhost:5173**.

## Configuration

Copier `.env.example` vers `.env` et ajuster si besoin :

| Variable | Default | Description |
|---|---|---|
| `ORCHESTRATOR_PORT` | 8000 | Port de l'orchestrateur |
| `BRAIN_PORT` | 11434 | Port Ollama |
| `MEMORY_PORT` | 8001 | Port du service mémoire |
| `FRONTEND_PORT` | 5173 | Port du frontend |
| `OLLAMA_MODEL` | gemma3:1b | Modèle LLM utilisé |

---

## Roadmap

### v0.1 — Le cerveau qui parle (texte) `<-- ON EST ICI`
- Orchestrator FastAPI + Ollama + ChromaDB + React chat
- System prompt "Aria/Ripley" + réponses JSON (text + emotion + tone)
- Mémoire court terme (conversations) + long terme (faits utilisateur)
- UI : bulles de chat, indicateur d'émotion, statut "Aria réfléchit..."

### v0.2 — La voix
- Service STT (faster-whisper) — speech-to-text local
- Service TTS (Piper) — text-to-speech avec voix custom
- Pipeline : audio → texte → brain → texte → audio
- Nouveau conteneur Docker pour chaque service audio

### v0.3 — L'interaction naturelle
- Full-duplex WebSocket streaming (parler et écouter en même temps)
- VAD (Voice Activity Detection) — détecter quand l'utilisateur parle
- Interruption par mot-clé "Stop" ou en parlant par-dessus
- Gestion de la priorité utilisateur (Aria se tait quand on l'interrompt)

### v0.4 — La personnalité
- Construction d'un dataset LoRA pour le roleplay Aria
- Fine-tuning de Gemma pour coller parfaitement au personnage
- Enrichissement du format émotions (plus de nuances, mémoire émotionnelle)

### v0.5 — L'avatar
- Affichage d'un avatar 2D/3D animé dans le frontend
- Animations basées sur le JSON emotion/tone (expressions faciales, gestuelles)
- Synchronisation lèvres avec le TTS

---

## Stack technique

| Couche | Techno |
|---|---|
| LLM | Ollama + Gemma 3 1B |
| Mémoire | ChromaDB (embeddings all-MiniLM-L6-v2) |
| Backend | FastAPI (Python 3.11) |
| Frontend | React 19 + Vite + TypeScript |
| Infra | Docker Compose |
