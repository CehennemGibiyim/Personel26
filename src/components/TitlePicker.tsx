"use client";
import { TITLE_GROUPS, PERSONNEL_TYPE_META, suggestedTypeForTitle, type PersonnelType } from "@/lib/shared";

/**
 * Ünvan seçici: gruplu hazır liste + serbest yazım.
 * - Soldaki listeden seçilirse metin kutusu dolar ve grubun sınıfı önerilir.
 * - Listede olmayan ünvan doğrudan metin kutusuna yazılabilir.
 */
export default function TitlePicker({ value, onChange, onSuggestType }: {
  value: string;
  onChange: (v: string) => void;
  onSuggestType?: (t: PersonnelType) => void;
}) {
  const inList = TITLE_GROUPS.some(g => g.titles.includes(value));
  const suggested = suggestedTypeForTitle(value);

  return (
    <div className="space-y-1.5">
      <div className="grid sm:grid-cols-2 gap-2">
        <select
          value={inList ? value : ""}
          onChange={e => {
            const v = e.target.value;
            if (!v) return;
            onChange(v);
            const t = suggestedTypeForTitle(v);
            if (t && onSuggestType) onSuggestType(t);
          }}
          className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-sky-400/70 [&>optgroup]:bg-slate-900 [&_option]:bg-slate-900"
        >
          <option value="">Listeden seçin…</option>
          {TITLE_GROUPS.map(g => (
            <optgroup key={g.group} label={`${g.group} · önerilen: ${PERSONNEL_TYPE_META[g.type].label}`}>
              {g.titles.map(t => <option key={t} value={t}>{t}</option>)}
            </optgroup>
          ))}
        </select>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="…veya ünvanı kendiniz yazın"
          className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-sky-400/70 placeholder:text-white/25"
        />
      </div>
      <p className="text-white/30 text-[10.5px]">
        {suggested
          ? <>Bu ünvan için önerilen sınıf: <b className="text-white/60">{PERSONNEL_TYPE_META[suggested].label}</b> (aşağıdan değiştirebilirsiniz).</>
          : "Hemşirelik, hekim, teknik, idari, destek (temizlik, güvenlik, mutfak…) ve teknik hizmet ünvanları listede. Listede yoksa sağdaki kutuya yazın."}
      </p>
    </div>
  );
}
