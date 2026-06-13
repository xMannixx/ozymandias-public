type TaskbarWindow = {
  id: string;
  title: string;
  isMinimized: boolean;
};

type WindowTaskbarProps = {
  windows: TaskbarWindow[];
  onRestore: (id: string) => void;
};

function WindowTaskbar({ windows, onRestore }: WindowTaskbarProps): JSX.Element | null {
  const minimized = windows.filter((windowItem) => windowItem.isMinimized);
  if (minimized.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-3 left-1/2 z-[90] w-[min(980px,95vw)] -translate-x-1/2 rounded-xl border border-gray-700 bg-[#0d1117]/85 p-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        {minimized.map((windowItem) => (
          <button
            key={windowItem.id}
            type="button"
            className="max-w-56 truncate rounded-md border border-blue-600/40 bg-blue-900/35 px-3 py-1.5 text-xs text-blue-100 hover:bg-blue-800/45"
            onClick={() => onRestore(windowItem.id)}
          >
            {windowItem.title}
          </button>
        ))}
      </div>
    </div>
  );
}

export default WindowTaskbar;
