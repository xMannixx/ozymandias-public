import { type ReactNode } from "react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";
import Button from "@/components/common/Button";

type Position = { x: number; y: number };
type Size = { width: number; height: number };

type FloatingWindowProps = {
  title: string;
  windowId: string;
  position: Position;
  size: Size;
  defaultPosition?: Position;
  defaultSize?: Size;
  minWidth?: number;
  minHeight?: number;
  zIndex?: number;
  isMaximized?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onBringToFront?: () => void;
  onToggleMaximize?: () => void;
  onGeometryChange?: (position: Position, size: Size) => void;
  children: ReactNode;
};

function FloatingWindow({
  title,
  windowId,
  position,
  size,
  defaultPosition = { x: 120, y: 120 },
  defaultSize = { width: 860, height: 620 },
  minWidth = 400,
  minHeight = 300,
  zIndex = 10,
  isMaximized = false,
  onClose,
  onMinimize,
  onBringToFront,
  onToggleMaximize,
  onGeometryChange,
  children,
}: FloatingWindowProps): JSX.Element {
  const handleDragStop: RndDragCallback = (_event, data) => {
    onGeometryChange?.({ x: data.x, y: data.y }, size);
  };

  const handleResizeStop: RndResizeCallback = (_event, _direction, ref, _delta, nextPosition) => {
    onGeometryChange?.(
      { x: nextPosition.x, y: nextPosition.y },
      { width: ref.offsetWidth, height: ref.offsetHeight },
    );
  };

  return (
    <Rnd
      data-testid={`floating-window-${windowId}`}
      className="overflow-hidden rounded-xl border border-blue-500/30 bg-[#0d1117]/92 shadow-[0_0_28px_rgba(88,166,255,0.22)] backdrop-blur"
      dragHandleClassName={`floating-window-drag-handle-${windowId}`}
      default={{ x: defaultPosition.x, y: defaultPosition.y, width: defaultSize.width, height: defaultSize.height }}
      position={{ x: position.x, y: position.y }}
      size={{ width: size.width, height: size.height }}
      minWidth={minWidth}
      minHeight={minHeight}
      disableDragging={isMaximized}
      enableResizing={!isMaximized}
      style={{ zIndex }}
      onMouseDown={() => onBringToFront?.()}
      onDragStart={() => onBringToFront?.()}
      onResizeStart={() => onBringToFront?.()}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
    >
      <div className="flex h-full flex-col">
        <header
          className={`floating-window-drag-handle-${windowId} flex cursor-move items-center justify-between border-b border-blue-500/20 bg-[#0d1117]/90 px-3 py-2`}
          onDoubleClick={onToggleMaximize}
        >
          <h3 className="truncate pr-2 text-sm font-semibold text-blue-200">{title}</h3>
          <div className="flex items-center gap-2">
            {onMinimize ? (
              <Button type="button" variant="ghost" className="h-7 px-2 py-0 text-xs" onClick={onMinimize}>
                -
              </Button>
            ) : null}
            <Button type="button" variant="danger" className="h-7 px-2 py-0 text-xs" onClick={onClose}>
              x
            </Button>
          </div>
        </header>
        <div className="h-full overflow-auto bg-[#0d1117]/80 p-3">{children}</div>
      </div>
    </Rnd>
  );
}

export default FloatingWindow;
