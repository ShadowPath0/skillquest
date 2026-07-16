"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

export function SkillRadarChart({ data }: { data: { skill: string; score: number }[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Pas assez de données pour afficher un radar de compétences.
      </p>
    );
  }

  const MAX_LABEL_CHARS = 18;
  const truncateLabel = (skill: string) =>
    skill.length > MAX_LABEL_CHARS ? `${skill.slice(0, MAX_LABEL_CHARS - 1)}…` : skill;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="65%">
          <PolarGrid />
          <PolarAngleAxis dataKey="skill" tickFormatter={truncateLabel} tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar
            name="Score"
            dataKey="score"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
