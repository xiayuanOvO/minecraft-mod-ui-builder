"use client";

import WIDGET_REGISTRY from "@/lib/widgetRegistry";
import { useLocale } from "@/lib/i18n";

interface Props {
  onAdd: (type: string) => void;
}

export default function Palette({ onAdd }: Props) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{t("Widgets")}</div>
      {WIDGET_REGISTRY.map((def) => (
        <button
          key={def.type}
          className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1.5 text-left text-xs text-gray-800 font-medium hover:bg-gray-200 active:bg-gray-300"
          onClick={() => onAdd(def.type)}
        >
          + {t(def.label)}
        </button>
      ))}
    </div>
  );
}
