export function OverviewCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 hover:shadow-xl transition-all">
      <div className={`h-10 w-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-2 shadow-lg`}>
        <span className="text-base font-bold text-white">{value}</span>
      </div>
      <p className="text-xs font-semibold text-slate-600">{label}</p>
    </div>
  );
}
