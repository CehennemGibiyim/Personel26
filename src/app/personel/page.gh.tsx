"use client";
/** GitHub Pages sürümü: personel bilgi ekranı (tarayıcı içi veritabanı). */
import StaticBoot from "@/components/StaticBoot";
import PersonelSelfService from "./page";

export default function StaticPersonel() {
  return <StaticBoot>{() => <PersonelSelfService />}</StaticBoot>;
}
