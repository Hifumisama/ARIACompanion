# aria-ui-frontend

Interface utilisateur chat pour ARIACompanion.

## Description

Application React permettant de discuter avec un personnage IA en temps réel, avec support vocal bidirectionnel (STT + TTS) et détection automatique de la parole (VAD).

## Architecture

```
aria-ui-frontend/
  src/
    App.tsx                 # Point d'entrée
    App.css                 # Styles
    types.ts                # Types WebSocket
    components/
      Chat.tsx              # Interface de chat principale
      EmotionIndicator.tsx  # Indicateur d'émotion du personnage
    hooks/
      useWebSocket.ts       # Connexion WebSocket + parsing messages
      useVAD.ts             # Voice Activity Detection (mains libres)
      useAudioPlayback.ts   # Lecture audio TTS
      useAudioRecording.ts  # Enregistrement micro (push-to-talk)
```

## Fonctionnalités

- **Chat texte** : saisie classique avec streaming token par token
- **Mode mains libres (VAD)** : détection automatique de la parole via ONNX, transcription automatique
- **Push-to-talk** : bouton micro pour enregistrement manuel
- **TTS** : lecture audio des réponses du personnage (streaming binaire via WebSocket)
- **Interruption** : possibilité d'interrompre la génération (bouton STOP ou parole)
- **Émotions** : indicateur visuel de l'état émotionnel du personnage

## Protocole WebSocket

Le frontend communique avec `aria-orchestrator` via WebSocket. Voir le [README de l'orchestrateur](../aria-orchestrator/README.md) pour le protocole complet.

## Hooks

| Hook | Rôle |
|------|------|
| `useWebSocket` | Gère la connexion WS, le parsing des messages, l'accumulation des chunks TTS |
| `useVAD` | Voice Activity Detection via modèle ONNX, déclenche la transcription |
| `useAudioPlayback` | Lit les blobs audio reçus via Web Audio API |
| `useAudioRecording` | MediaRecorder pour l'enregistrement micro manuel |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_WS_URL` | `ws://localhost:4545/ws` | URL WebSocket de l'orchestrateur |
| `VITE_API_URL` | `http://localhost:4545` | URL REST de l'orchestrateur |

## Port

| Port | Description |
|------|-------------|
| 5173 | Vite dev server |
