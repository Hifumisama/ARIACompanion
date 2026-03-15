# ARIA Dataset Generator

Outil web de génération de datasets d'entraînement pour le LoRA Hadès via Ollama — **optimisé avec génération par batches et estimation de temps**.

## Installation

```bash
cd dataset-generator
npm install
```

## Utilisation

### 1. Démarrer Ollama
Assurez-vous qu'Ollama tourne sur `http://localhost:11434`:
```bash
ollama serve
```

### 2. Lancer le générateur
```bash
npm run dev
```
Puis ouvrez `http://localhost:5174`

### 3. Configurer et générer

**Panel de configuration (gauche):**
- **Modèle**: Auto-détecté depuis Ollama (défaut: premier avec "gemma")
- **System Prompt**: Pré-rempli avec le prompt Hadès
- **Exemples**: Collez des entrées JSON existantes pour guider le modèle
- **Nombre d'entrées**: Curseur 1-500
- **ID de départ**: Défaut 441 (après dataset_5.json)
- **Taille des batches**: Défaut 10 (nombre d'entrées par requête)

**Panel de progression (haut droit):**
- Barre de progression en temps réel
- Compteur `X / Y entrées générées`
- Numéro du batch courant et temps moyen par batch
- **⏱️ Estimation du temps restant** basée sur les performances réelles

### 4. Affichage des résultats

**Vue structurée (par défaut):**
- Liste compacte : `▶ ID 441 [sarcastic]`
- Cliquez pour développer (accordéon) et voir tous les champs
- Champs affichés: context, instruction, input, tone, action, text

**Mode brut:**
- Cliquez **"⚙️ Mode brut"** pour voir le JSON complet en temps réel
- Utile pour vérifier la formation du JSON pendant la génération

### 5. Télécharger le JSON
Une fois générées, cliquez **"⬇ Télécharger JSON"** pour récupérer les entrées au format standard ARIA.

## Améliorations principales

✅ **Génération par batches** — Requêtes groupées (10 par défaut) au lieu d'une par une
✅ **Estimation de temps** — Calcul dynamique basé sur le temps réel des batches
✅ **Entrées développables** — Accordéon pour voir les détails complets
✅ **Mode brut** — Visualisation du JSON brut en temps réel
✅ **Annulation** — AbortController pour arrêter proprement à tout moment

## Architecture

- `src/App.tsx` — Orchestration + état global + logique de batches + estimation
- `src/types.ts` — Définitions TypeScript
- `src/services/ollama.ts` — `generateBatch()` pour créer N entrées en 1 requête
- `src/components/` :
  - `ConfigPanel.tsx` — Paramètres + taille de batch
  - `ProgressBar.tsx` — Barre + temps estimé
  - `ResultPanel.tsx` — Accordéon + mode brut

## Format attendu

Chaque entrée doit suivre ce schéma:
```json
{
  "id": <number>,
  "context": "<string>",
  "instruction": "<string>",
  "input": "<string>",
  "output": {
    "tone": "<sarcastic|scheming|annoyed|amused|furious|calm>",
    "action": "<string>",
    "text": "<string>"
  }
}
```

## Notes de performance

- **Batch size recommandé**: 10 (bon compromis vitesse/stabilité)
- Pour 100 entrées : ~10 batches, estimation affichée en direct
- Chaque batch retourne sa durée pour affiner l'estimation
- Les retries automatiques (max 2 par batch) aident à la robustesse

## Annulation

Pendant la génération, cliquez **"Annuler"** pour arrêter les appels Ollama en cours. Les entrées déjà générées restent disponibles au téléchargement.
