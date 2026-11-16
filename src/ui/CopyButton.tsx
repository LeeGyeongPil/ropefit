import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

export function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Clear the pending "Copied" reset if the component goes away.
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className="copy"
      onClick={() => {
        void navigator.clipboard?.writeText(text).catch(() => undefined);
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? t("button.copied") : t("button.copy")}
    </button>
  );
}
