"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";

export default function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();
  const next = locale === "en" ? "zh" : "en";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5"
      onClick={() => setLocale(next)}
      title={`${t("Language")}: ${next === "zh" ? "中文" : "English"}`}
      aria-label={`${t("Language")}: ${next === "zh" ? "中文" : "English"}`}
    >
      <Languages className="size-4" />
      {locale === "en" ? "中文" : "English"}
    </Button>
  );
}
