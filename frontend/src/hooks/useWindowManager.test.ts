import { act, renderHook } from "@testing-library/react";
import { useWindowManager } from "@/hooks/useWindowManager";

describe("useWindowManager", () => {
  it("openWindow erstellt neues fenster", () => {
    const { result } = renderHook(() => useWindowManager());

    act(() => {
      result.current.openWindow("p1", "Projekt 1");
    });

    expect(result.current.windows).toHaveLength(1);
    expect(result.current.windows[0].title).toBe("Projekt 1");
  });

  it("openWindow auf bestehendes fenster setzt minimized false", () => {
    const { result } = renderHook(() => useWindowManager());
    act(() => {
      result.current.openWindow("p1", "Projekt 1");
      result.current.minimizeWindow("p1");
      result.current.openWindow("p1", "Projekt 1");
    });

    expect(result.current.windows).toHaveLength(1);
    expect(result.current.windows[0].isMinimized).toBe(false);
  });

  it("minimize und restore funktionieren", () => {
    const { result } = renderHook(() => useWindowManager());
    act(() => {
      result.current.openWindow("p1", "Projekt 1");
      result.current.minimizeWindow("p1");
    });
    expect(result.current.windows[0].isMinimized).toBe(true);

    act(() => {
      result.current.restoreWindow("p1");
    });
    expect(result.current.windows[0].isMinimized).toBe(false);
  });

  it("toggleMaximizeWindow toggelt maximized", () => {
    const { result } = renderHook(() => useWindowManager());
    act(() => {
      result.current.openWindow("p1", "Projekt 1");
      result.current.toggleMaximizeWindow("p1");
    });
    expect(result.current.windows[0].isMaximized).toBe(true);

    act(() => {
      result.current.toggleMaximizeWindow("p1");
    });
    expect(result.current.windows[0].isMaximized).toBe(false);
  });

  it("closeWindow entfernt fenster", () => {
    const { result } = renderHook(() => useWindowManager());
    act(() => {
      result.current.openWindow("p1", "Projekt 1");
      result.current.closeWindow("p1");
    });
    expect(result.current.windows).toHaveLength(0);
  });
});
