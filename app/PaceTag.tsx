"use client";

import { useI18n } from "../lib/i18n";
import type { RunPace } from "../lib/pace";

export default function PaceTag({ pace, className = "" }: { pace: RunPace; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={`pace-tag ${pace.band} ${className}`.trim()} title={t("pace.help")}>
      <i />
      <span>{t(`pace.${pace.band}`)}</span>
      <b>{pace.percent.toLocaleString()}%</b>
    </span>
  );
}
