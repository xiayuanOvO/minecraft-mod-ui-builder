"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getStoredConsent, setConsent } from "@/lib/analytics";
import { useLocale } from "@/lib/i18n";

export function CookieConsentBanner() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consent must be read from localStorage after mount to avoid SSR mismatch
    setVisible(getStoredConsent() === null);
  }, []);

  if (!visible) return null;

  const choose = (choice: "granted" | "denied") => {
    setConsent(choice);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t border-border bg-background p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {t("We use cookies to understand how you use this app and improve it. You can accept or decline non-essential analytics cookies.")}
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={() => choose("denied")}>
          {t("Decline")}
        </Button>
        <Button size="sm" onClick={() => choose("granted")}>
          {t("Accept")}
        </Button>
      </div>
    </div>
  );
}
