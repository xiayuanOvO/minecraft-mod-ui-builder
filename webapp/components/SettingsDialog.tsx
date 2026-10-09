"use client";

import { useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Settings, Sun, Moon, Monitor, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ScreenSpec } from "@/lib/types";
import { useLocale } from "@/lib/i18n";

interface Props {
  screen: ScreenSpec;
  onScreenChange: (patch: Partial<ScreenSpec>) => void;
  onResetTextures: () => Promise<void>;
  onViewTextures: () => void;
  onExtractPack: (file: File) => Promise<{ extracted: string[]; missing: string[] }>;
}

export default function SettingsDialog({
  screen,
  onScreenChange,
  onResetTextures,
  onViewTextures,
  onExtractPack,
}: Props) {
  const [open, setOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [packLoading, setPackLoading] = useState(false);
  const [packResult, setPackResult] = useState<{ extracted: string[]; missing: string[] } | null>(null);
  const packInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();

  const handleReset = async () => {
    setResetLoading(true);
    try { await onResetTextures(); } finally { setResetLoading(false); }
  };

  const handlePackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPackLoading(true);
    setPackResult(null);
    try {
      const result = await onExtractPack(file);
      setPackResult(result);
    } finally {
      setPackLoading(false);
    }
  };

  const busy = resetLoading || packLoading;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 px-0"
        onClick={() => setOpen(true)}
        title={t("Settings")}
      >
        <Settings className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Settings")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-2">
            {/* Project */}
            <section className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("Project")}</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-modid">Mod ID</Label>
                <Input
                  id="settings-modid"
                  placeholder="e.g. my_mod"
                  value={screen.modId ?? ""}
                  onChange={(e) => onScreenChange({ modId: e.target.value || undefined })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("Namespace prepended to action and binding IDs when no colon is present.")}
                </p>
              </div>
            </section>

            <Separator />

            {/* Appearance */}
            <section className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("Appearance")}</p>
              <div className="flex items-center justify-between">
                <Label>{t("Theme")}</Label>
                <div className="flex items-center rounded-md border overflow-hidden">
                  {(["light", "system", "dark"] as const).map((themeOption) => {
                    const Icon = themeOption === "light" ? Sun : themeOption === "dark" ? Moon : Monitor;
                    return (
                      <button
                        key={themeOption}
                        onClick={() => setTheme(themeOption)}
                        title={t(themeOption.charAt(0).toUpperCase() + themeOption.slice(1))}
                        className={`flex h-8 w-9 items-center justify-center transition-colors ${
                          theme === themeOption
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <Separator />

            {/* Textures */}
            <section className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("Textures")}</p>
              <div className="flex flex-col gap-2">
                <input
                  ref={packInputRef}
                  type="file"
                  accept=".jar,.zip"
                  className="hidden"
                  onChange={handlePackFile}
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm">{t("Load from JAR / Resource Pack")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("Upload your own ")}<code className="font-mono">1.21.x.jar</code>{t(" or a ")}<code className="font-mono">.zip</code>{t(" resource pack — textures are extracted client-side and never sent to a server.")}
                    </p>
                    {packResult && (
                      <p className="text-xs mt-1">
                        <span className="text-green-600 dark:text-green-400">
                          {packResult.extracted.length} {t("extracted")}
                        </span>
                        {packResult.missing.filter(n => n !== "mc_scrollbar_handle.png").length > 0 && (
                          <span className="text-muted-foreground">
                            {" · "}{t("not found:")} {packResult.missing.filter(n => n !== "mc_scrollbar_handle.png").join(", ")}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => packInputRef.current?.click()}
                    disabled={busy}
                    className="shrink-0"
                  >
                    {packLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("Browse")}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{t("View Textures")}</p>
                    <p className="text-xs text-muted-foreground">{t("Browse loaded texture atlas")}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setOpen(false); onViewTextures(); }} className="shrink-0">
                    {t("Open")}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{t("Reset Textures")}</p>
                    <p className="text-xs text-muted-foreground">{t("Remove all custom textures")}</p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={handleReset} disabled={busy} className="shrink-0">
                    {resetLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("Reset")}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
