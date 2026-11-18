import i18next, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import { appLocaleFromHost, appLocaleToHost, embedParentOrigin, isEmbedMode } from "@/lib/embed-mode";
import { useLocaleStore } from "@/stores/use-locale-store";
import { AREA_CATALOGS } from "./areas";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type AppLocale } from "./locales";
import { deDE } from "./messages/de-DE";
import { enUS } from "./messages/en-US";
import { frFR } from "./messages/fr-FR";
import { jaJP } from "./messages/ja-JP";
import { koKR } from "./messages/ko-KR";
import { zhCN } from "./messages/zh-CN";
import { personalAppearanceMessages } from "./personal-appearance-messages";
import { personalAvatarMessages } from "./personal-avatar-messages";

const CORE_CATALOGS: Record<AppLocale, object> = { "zh-CN": zhCN, "en-US": enUS, "fr-FR": frFR, "de-DE": deDE, "ja-JP": jaJP, "ko-KR": koKR };

/** 每种语言 = 公共目录 + 各页面区域目录（区域名作为顶级命名空间）。 */
function buildResources(): Resource {
    return Object.fromEntries(
        SUPPORTED_LOCALES.map(({ code }) => [
            code,
            {
                translation: {
                    ...CORE_CATALOGS[code],
                    personalAppearance: personalAppearanceMessages[code],
                    personalAvatar: personalAvatarMessages[code],
                    ...Object.fromEntries(Object.entries(AREA_CATALOGS).map(([area, catalog]) => [area, catalog[code]])),
                },
            },
        ]),
    );
}

/**
 * 应用唯一的 i18next 实例。语言来自 useLocaleStore（本设备偏好，首次按浏览器语言），
 * 缺失的键回退到简体中文，保证未翻译的页面仍可用。资源随包内联，初始化同步完成。
 */
export const i18n = i18next.createInstance();

// 嵌入模式：宿主语言是权威来源。URL 的 lang 参数在 i18n 初始化前写入 store，
// 保证首帧语言与宿主一致（persist 同步落盘，整页刷新后仍保持）。
if (typeof window !== "undefined" && isEmbedMode()) {
    const langParam = appLocaleFromHost(new URLSearchParams(window.location.search).get("lang"));
    if (langParam && langParam !== useLocaleStore.getState().locale) {
        useLocaleStore.getState().setLocale(langParam);
    }
}

void i18n.use(initReactI18next).init({
    resources: buildResources(),
    lng: useLocaleStore.getState().locale,
    fallbackLng: DEFAULT_LOCALE,
    initAsync: false,
    returnNull: false,
    interpolation: { escapeValue: false },
});

useLocaleStore.subscribe((state, previous) => {
    if (state.locale !== previous.locale) void i18n.changeLanguage(state.locale);
});

// 嵌入模式语言双向同步：宿主切换 → postMessage 进来走 switchLocale（整页刷新保持单语言）；
// 本应用内切换（顶栏语言菜单）→ postMessage 回传宿主。
if (typeof window !== "undefined" && isEmbedMode() && window.parent !== window) {
    window.addEventListener("message", (event) => {
        if (event.origin !== embedParentOrigin()) return;
        const data = event.data as { source?: string; type?: string; locale?: string } | null;
        if (data?.source !== "glowpix-host" || data.type !== "set-locale") return;
        const next = appLocaleFromHost(data.locale);
        if (next) switchLocale(next);
    });
    useLocaleStore.subscribe((state, previous) => {
        if (state.locale === previous.locale) return;
        window.parent.postMessage(
            { source: "yingce-embed", type: "locale", locale: appLocaleToHost(state.locale) },
            embedParentOrigin(),
        );
    });
}

/** 当前界面语言；用于 Intl 日期与数字格式化。 */
export function currentLocale(): AppLocale {
    return useLocaleStore.getState().locale;
}

/** 非组件代码（服务层、工具函数）使用的翻译函数。 */
export function translate(key: string, options?: Record<string, unknown>): string {
    return i18n.t(key, options) as string;
}

/**
 * 用户切换界面语言：保存偏好后整页刷新。部分文案在模块加载或缓存数据里生成，
 * 只靠组件重渲染会出现新旧语言混排；刷新保证整页使用同一种语言。
 */
export function switchLocale(next: AppLocale) {
    if (next === currentLocale()) return;
    useLocaleStore.getState().setLocale(next);
    if (typeof window !== "undefined") window.location.reload();
}
