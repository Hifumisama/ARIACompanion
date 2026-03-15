# ARIA Dataset Generator

Outil web de génération et d'affinage de datasets d'entraînement pour le LoRA Hadès via Ollama — avec génération par batches, LLM-as-a-Judge, et régénération assistée.

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

### 3. Onglet Configuration

- **Modèle**: Auto-détecté depuis Ollama (défaut: premier avec "gemma")
- **System Prompt**: Pré-rempli avec le prompt Hadès
- **Exemples**: Collez des entrées JSON existantes pour guider le modèle
- **Nombre d'entrées**: Curseur 1-500
- **ID de départ**: Défaut 1
- **Taille des batches**: Défaut 10 (nombre d'entrées par requête)
- **Bouton Générer**: En bas de la configuration, lance la génération et bascule sur l'onglet Génération

### 4. Onglet Génération

- **Barre de progression** avec bouton Annuler intégré
- Compteur d'entrées, batch courant, temps moyen et estimation du temps restant
- **Notification sonore + visuelle** (toast) à la fin de la génération
- **Vue structurée** (accordéon) : cliquez pour développer et voir tous les champs
- **Mode brut** : visualisation du JSON complet
- **Télécharger JSON** : export des entrées générées

### 5. Onglet Affinage (LLM-as-a-Judge)

L'onglet affinage permet d'évaluer, éditer et améliorer les entrées générées.

**Tableau principal :**
- Colonnes : checkbox, ID, contexte, instruction, score (1-10), actions
- Cliquer sur une ligne pour voir l'input et l'output côte à côte
- Tri par score (ascendant/descendant) en cliquant sur l'en-tête "Score"
- Sélection multiple via checkboxes, avec compteur au-dessus du tableau

**Actions disponibles :**

- **Importer JSON** : charger des entrées depuis un fichier
- **Exporter JSON** : télécharger les entrées affinées (sans les scores/commentaires du juge)
- **Analyser** : ouvre une modale pour évaluer les entrées via un LLM juge
  - Choix du modèle juge (peut être différent du modèle générateur)
  - Prompt d'évaluation personnalisable, avec possibilité de cloner le system prompt ou de **générer automatiquement** une prompt juge via le LLM
  - Si aucune entrée sélectionnée → analyse toutes les entrées
  - Si sélection → analyse uniquement les entrées sélectionnées
  - Score (1-10) + commentaire court (2 lignes max avec recommandations)
- **Régénérer** : régénère les entrées sélectionnées via un modèle
  - Choix du modèle et prompt de régénération
  - Option **"Utiliser les commentaires du juge"** : quand cochée, le champ prompt devient optionnel et les commentaires du juge guident directement la régénération
  - Le score est remis à zéro après régénération
- **Éditer** : modale d'édition manuelle par entrée (tous les champs sauf l'ID)
- **Supprimer** : supprime les entrées sélectionnées

**Commentaire du juge :**
- Visible dans la vue détaillée de chaque entrée (sous input/output)
- Indique le modèle utilisé (ex: "Commentaire du juge (qwen3:8b)")

## Architecture

- `src/App.tsx` — Orchestration, état global, logique de batches, toasts
- `src/types.ts` — `DatasetEntry`, `AffinageEntry` (extends avec score/commentaire), `GenerationConfig`
- `src/services/ollama.ts` :
  - `generateBatch()` — Génère N entrées en 1 requête
  - `judgeEntry()` — Évaluation par LLM juge (score + commentaire)
  - `regenerateEntry()` — Régénération assistée (avec commentaires du juge optionnels)
  - `generateJudgePrompt()` — Auto-génération de prompt juge depuis le system prompt
  - `safeJsonParse()` — Parsing JSON robuste (nettoyage markdown, balises `<think>`, extraction `{...}`)
- `src/components/` :
  - `ConfigPanel.tsx` — Paramètres + bouton générer
  - `ProgressBar.tsx` — Barre de progression + estimations
  - `ResultPanel.tsx` — Accordéon + mode brut + pagination
  - `AffinagePanel.tsx` — Tableau, modales (édition/analyse/régénération), tri, import/export

## Format attendu

Chaque entrée doit suivre ce schéma:
```json
{
  "id": 1,
  "context": "string",
  "instruction": "string",
  "input": "string",
  "output": {
    "tone": "sarcastic|scheming|annoyed|amused|furious|calm",
    "action": "string",
    "text": "string"
  }
}
```

## Notes

- **Batch size recommandé**: 10 (bon compromis vitesse/stabilité)
- Retries automatiques (max 2 par requête) pour la robustesse
- Parsing JSON robuste : gère les balises `<think>` (Qwen), les blocs markdown, et les réponses mal formées
- Notifications sonores via Web Audio API (pas de fichier audio nécessaire)
- L'affinage utilise un type `AffinageEntry` qui étend `DatasetEntry` — les scores/commentaires ne sont pas inclus dans l'export JSON
