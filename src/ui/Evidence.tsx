import type { Basis } from "../core/types";
import { useI18n } from "../i18n";

/** Source/docs badge with the checked date and a link to the evidence. */
export function Evidence({ basis, sourceUrl, checked }: { basis: Basis; sourceUrl: string; checked: string }) {
  const { t } = useI18n();
  return (
    <span className="evidence">
      <span className={`badge badge-${basis}`}>{t(`badge.${basis}`)}</span>{" "}
      <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
        {t("evidence")}
      </a>{" "}
      <small>{t("checked", { date: checked })}</small>
    </span>
  );
}
