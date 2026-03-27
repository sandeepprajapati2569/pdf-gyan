import type { ReactNode } from "react";

type SectionIntroProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  align?: "left" | "center";
};

export default function SectionIntro({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionIntroProps) {
  return (
    <div
      className={`section-intro ${
        align === "center" ? "items-center text-center" : ""
      }`}
    >
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="font-display text-4xl text-slate-950 sm:text-5xl">{title}</h2>
      <div className="max-w-3xl text-lg leading-8 text-slate-600">{description}</div>
    </div>
  );
}
