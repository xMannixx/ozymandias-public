import { useCallback, useMemo, useState } from "react";

type WindowPosition = { x: number; y: number };
type WindowSize = { width: number; height: number };

export type WindowState = {
  id: string;
  title: string;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: WindowPosition;
  size: WindowSize;
  restorePosition: WindowPosition | null;
  restoreSize: WindowSize | null;
};

type UseWindowManagerResult = {
  windows: WindowState[];
  openWindow: (
    id: string,
    title: string,
    defaultPosition?: WindowPosition,
    defaultSize?: WindowSize,
  ) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  updateWindowGeometry: (id: string, position: WindowPosition, size: WindowSize) => void;
  toggleMaximizeWindow: (id: string) => void;
};

const DEFAULT_POSITION: WindowPosition = { x: 120, y: 140 };
const DEFAULT_SIZE: WindowSize = { width: 860, height: 620 };
const BASE_Z_INDEX = 10;

export function useWindowManager(): UseWindowManagerResult {
  const [windows, setWindows] = useState<WindowState[]>([]);

  const highestZIndex = useMemo(
    () => windows.reduce((max, item) => Math.max(max, item.zIndex), BASE_Z_INDEX),
    [windows],
  );

  const openWindow = useCallback(
    (id: string, title: string, defaultPosition?: WindowPosition, defaultSize?: WindowSize) => {
      setWindows((current) => {
        const existing = current.find((windowItem) => windowItem.id === id);
        const nextZIndex = Math.max(
          BASE_Z_INDEX,
          current.reduce((max, windowItem) => Math.max(max, windowItem.zIndex), BASE_Z_INDEX) + 1,
        );

        if (existing) {
          return current.map((windowItem) =>
            windowItem.id === id
              ? {
                  ...windowItem,
                  title,
                  isMinimized: false,
                  zIndex: nextZIndex,
                }
              : windowItem,
          );
        }

        return [
          ...current,
          {
            id,
            title,
            isMinimized: false,
            isMaximized: false,
            zIndex: nextZIndex,
            position: defaultPosition ?? DEFAULT_POSITION,
            size: defaultSize ?? DEFAULT_SIZE,
            restorePosition: null,
            restoreSize: null,
          },
        ];
      });
    },
    [],
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((current) => current.filter((item) => item.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((current) =>
      current.map((item) => (item.id === id ? { ...item, isMinimized: true } : item)),
    );
  }, []);

  const restoreWindow = useCallback(
    (id: string) => {
      const nextZIndex = highestZIndex + 1;
      setWindows((current) =>
        current.map((item) =>
          item.id === id ? { ...item, isMinimized: false, zIndex: nextZIndex } : item,
        ),
      );
    },
    [highestZIndex],
  );

  const bringToFront = useCallback(
    (id: string) => {
      const nextZIndex = highestZIndex + 1;
      setWindows((current) =>
        current.map((item) => (item.id === id ? { ...item, zIndex: nextZIndex } : item)),
      );
    },
    [highestZIndex],
  );

  const updateWindowGeometry = useCallback((id: string, position: WindowPosition, size: WindowSize) => {
    setWindows((current) =>
      current.map((item) => (item.id === id && !item.isMaximized ? { ...item, position, size } : item)),
    );
  }, []);

  const toggleMaximizeWindow = useCallback((id: string) => {
    setWindows((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }
        if (item.isMaximized) {
          return {
            ...item,
            isMaximized: false,
            position: item.restorePosition ?? DEFAULT_POSITION,
            size: item.restoreSize ?? DEFAULT_SIZE,
            restorePosition: null,
            restoreSize: null,
          };
        }
        return {
          ...item,
          isMaximized: true,
          restorePosition: item.position,
          restoreSize: item.size,
          position: { x: 8, y: 96 },
          size: {
            width: Math.max(window.innerWidth - 24, 640),
            height: Math.max(window.innerHeight - 128, 400),
          },
        };
      }),
    );
  }, []);

  return {
    windows,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    bringToFront,
    updateWindowGeometry,
    toggleMaximizeWindow,
  };
}
