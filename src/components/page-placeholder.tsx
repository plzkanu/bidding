interface PagePlaceholderProps {
  title: string;
  description: string;
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#004b87]">{title}</h1>
      <p className="mt-3 text-slate-600">{description}</p>
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-400">
        준비 중인 기능입니다.
      </div>
    </div>
  );
}
