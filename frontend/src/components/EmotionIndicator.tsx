const EMOTION_COLORS: Record<string, string> = {
  calm: "#4a90d9",        // bleu — mode par défaut
  amused: "#f0c040",      // or — quand il se marre
  annoyed: "#e08050",     // orange — agacé
  sarcastic: "#7b68ee",   // violet — mode punchline
  furious: "#ff2020",     // rouge vif — HERCULE
  scheming: "#50c878",    // vert — mode pacte/contrat
  menacing: "#8b0000",    // rouge sombre — menace froide
  theatrical: "#daa520",  // or sombre — mode drama queen
};

interface Props {
  emotion: string;
  intensity: number;
}

export function EmotionIndicator({ emotion, intensity }: Props) {
  const color = EMOTION_COLORS[emotion] || EMOTION_COLORS.calm;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 20,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        fontSize: 13,
        color,
        fontWeight: 600,
        transition: "all 0.3s ease",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          opacity: 0.4 + intensity * 0.6,
        }}
      />
      {emotion}
    </div>
  );
}
