'use client';

export type SupportQuickAction = {
  id: string;
  label: string;
  message: string;
};

export default function SupportQuickActions(props: {
  actions: SupportQuickAction[];
  onPick: (message: string) => void;
}) {
  const { actions, onPick } = props;

  return (
    <div className="px-4 pb-2">
      <p className="text-xs text-gray-500">Suggested questions</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.message)}
            className={[
              'text-xs px-3 py-1.5 rounded-full border',
              'bg-white border-gray-200 text-gray-700',
              'hover:bg-gray-50 hover:border-gray-300',
              'focus:outline-none focus:ring-2 focus:ring-[#0088CB]/30 focus:border-[#0088CB]/40',
            ].join(' ')}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

