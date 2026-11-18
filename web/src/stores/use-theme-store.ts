import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "light" | "dark";

type ThemeStore = {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
};

const VALID_THEMES: ThemeName[] = ["light", "dark"];

// 嵌入宿主（GlowPix 深色壳）且用户未显式选过主题时默认暗色；persist 的 merge 会在有存储值时覆盖此默认值。
function defaultTheme(): ThemeName {
    if (typeof window === "undefined") return "light";
    try {
        if (new URLSearchParams(window.location.search).get("embed") === "1") return "dark";
        if (sessionStorage.getItem("yingce:embed") === "1") return "dark";
    } catch { /* storage 不可用时保持浅色默认 */ }
    return "light";
}

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: defaultTheme(),
            // 写入前校验：非法 theme 直接忽略，防止 syncRemoteUserData 等路径绕过 merge 写入坏值
            setTheme: (next) => set((state) => (VALID_THEMES.includes(next) ? { theme: next } : state)),
        }),
        {
            name: "yingce:theme_store",
            // 持久化恢复校验：旧版本/坏 session 写入的非法值回退到 light，
            // 避免 canvasThemes[非法值] = undefined 触发 "reading 'node'" 崩溃
            merge: (persisted, current) => {
                const stored = (persisted || {}) as Partial<ThemeStore>;
                const theme = VALID_THEMES.includes(stored.theme as ThemeName)
                    ? (stored.theme as ThemeName)
                    : current.theme;
                return { ...current, theme };
            },
        },
    ),
);
