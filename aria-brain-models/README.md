# aria-brain-models

Service LLM basé sur [Ollama](https://ollama.com/) pour ARIACompanion.

## Description

Ce module fournit l'infrastructure d'inférence LLM via Ollama. Il remplace l'ancien `brain/` (llama-server) et `init/` (téléchargement HuggingFace) par une solution unifiée de gestion et de serving de modèles.

## Architecture

- **Aucun Dockerfile custom** : utilise l'image officielle `ollama/ollama`
- **Init container** : un service one-shot qui télécharge le modèle configuré au démarrage
- **GPU** : support NVIDIA via Docker GPU passthrough
- **Persistance** : volume Docker `ollama_data` pour les modèles téléchargés

## API

Ollama expose deux familles d'API :

### API native Ollama (utilisée par aria-orchestrator)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `POST /api/chat` | POST | Chat completion avec streaming NDJSON |
| `GET /api/tags` | GET | Liste des modèles disponibles |
| `POST /api/pull` | POST | Télécharger un modèle |
| `GET /` | GET | Health check |

### API OpenAI-compatible

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `POST /v1/chat/completions` | POST | Chat completion (format OpenAI) |

> **Note** : L'orchestrateur utilise l'API native `/api/chat` (et non `/v1/chat/completions`) pour bénéficier du support complet des paramètres comme `repeat_penalty`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_MODEL` | `hades-v1` | Nom du modèle à télécharger et utiliser |
| `OLLAMA_PORT` | `11434` | Port exposé sur l'hôte |

## Gestion des modèles

### Télécharger un modèle

```bash
# Via le container
docker exec aria-brain-models ollama pull <model-name>

# Via l'API
curl -X POST http://localhost:11434/api/pull -d '{"name": "model-name"}'
```

### Lister les modèles

```bash
curl http://localhost:11434/api/tags
```

### Utiliser un Modelfile custom

Pour importer un modèle GGUF custom :

```dockerfile
# Modelfile
FROM ./mon-modele.gguf

PARAMETER temperature 0.9
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.15
```

```bash
docker exec aria-brain-models ollama create mon-modele -f /path/to/Modelfile
```

## GPU

Le GPU NVIDIA est exposé automatiquement via la configuration Docker Compose :

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```

Prérequis : [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installé sur l'hôte.

## Port

| Port | Protocole | Description |
|------|-----------|-------------|
| 11434 | HTTP | API Ollama |
