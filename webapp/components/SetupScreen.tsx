"use client";

import { useRef, useState } from "react";
import { Loader2, PackageOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTextures } from "@/lib/TextureContext";
import LanguageToggle from "@/components/LanguageToggle";
import { useLocale } from "@/lib/i18n";

/**
 * Fallback screen — only shown when the automatic texture load (straight
 * from GitHub's raw CDN, see lib/extractFromGithub.ts) didn't fully succeed,
 * e.g. no network, GitHub unreachable, or a corporate proxy blocking it.
 * Lets you retry that, or load your own JAR/resource pack instead.
 */
export default function SetupScreen() {
  const { t } = useLocale();
  const { extractPack, reset } = useTextures();
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [packResult, setPackResult] = useState<{ extracted: number; missing: string[] } | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setLoading(true);
    setPackResult(null);
    setPackError(null);
    try {
      const result = await extractPack(file);
      setPackResult({ extracted: result.extracted.length, missing: result.missing });
    } catch (err) {
      setPackError(err instanceof Error ? err.message : t("Failed to read file."));
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await reset();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6">
      <div className="absolute right-5 top-5"><LanguageToggle /></div>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">MC Screen Designer</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          {t("Couldn’t automatically load the default textures (probably a network issue). Try again, or load your own game files instead — extracted locally, nothing leaves your browser.")}
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <Button onClick={handleRetry} disabled={retrying} variant="secondary" className="w-full">
          {retrying
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("Retrying…")}</>
            : <><RefreshCw className="mr-2 h-4 w-4" />{t("Try loading default textures again")}</>}
        </Button>

        <div className="rounded-lg border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <PackageOpen className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t("Load from Minecraft JAR or resource pack")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Select your ")}<code className="font-mono">1.21.x.jar</code>{t(" from your Minecraft install, or any ")}<code className="font-mono">.zip</code>{t(" resource pack.")}
              </p>
            </div>
          </div>

          <input ref={inputRef} type="file" accept=".jar,.zip" className="hidden" onChange={handleFile} />

          <Button onClick={() => inputRef.current?.click()} disabled={loading} className="w-full">
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("Extracting textures…")}</>
              : t("Browse for JAR / ZIP")}
          </Button>

          {packResult && (
            <p className="text-xs text-center">
              <span className="text-green-600 dark:text-green-400 font-medium">
                {packResult.extracted} / 7 {t("textures extracted")}
              </span>
              {packResult.missing.length > 0 && (
                <span className="text-muted-foreground">
                  {" — "}{packResult.missing.length} {t("not found in this pack")}
                </span>
              )}
            </p>
          )}

          {packError && (
            <p className="text-xs text-center text-destructive">{packError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
