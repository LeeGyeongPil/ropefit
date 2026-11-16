import { useI18n } from "../i18n";
import type { Lang } from "../i18n";

const LABELS: Record<Lang, string> = { en: "English", ko: "한국어" };

export function LangMenu() {
  const { lang, setLang, t } = useI18n();
  return (
    <select
      id="lang-menu"
      className="lang-menu"
      aria-label={t("lang.label")}
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
    >
      {(Object.keys(LABELS) as Lang[]).map((l) => (
        <option key={l} value={l}>
          {LABELS[l]}
        </option>
      ))}
    </select>
  );
}
