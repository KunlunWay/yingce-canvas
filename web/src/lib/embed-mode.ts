// 嵌入模式：宿主平台（GlowPix）以 iframe 嵌入时隐藏自带侧栏，由宿主侧栏替代。
// URL 参数 embed=1 触发，sessionStorage 持久化以覆盖应用内跳转与整页刷新。
import type { AppLocale } from "@/i18n/locales";

const EMBED_FLAG = "yingce:embed";

export function isEmbedMode(): boolean {
    if (typeof window === "undefined") return false;
    try {
        if (new URLSearchParams(window.location.search).get("embed") === "1") {
            sessionStorage.setItem(EMBED_FLAG, "1");
            return true;
        }
        return sessionStorage.getItem(EMBED_FLAG) === "1";
    } catch {
        return false;
    }
}

// postMessage 目标源：宿主页面来源；拿不到时退回 "*"（消息体只有路由路径，无敏感数据）。
export function embedParentOrigin(): string {
    try {
        return document.referrer ? new URL(document.referrer).origin : "*";
    } catch {
        return "*";
    }
}

// 宿主（GlowPix）语言值 → 本应用语言值；宿主支持的语言多于本应用时回退到相近语言。
const HOST_TO_APP_LOCALE: Record<string, AppLocale> = {
    en: "en-US",
    "zh-CN": "zh-CN",
    "zh-TW": "zh-CN",
    fr: "fr-FR",
    de: "de-DE",
    ja: "ja-JP",
    ko: "ko-KR",
};
const APP_TO_HOST_LOCALE: Record<AppLocale, string> = {
    "zh-CN": "zh-CN",
    "en-US": "en",
    "fr-FR": "fr",
    "de-DE": "de",
    "ja-JP": "ja",
    "ko-KR": "ko",
};

export function appLocaleFromHost(value: string | null | undefined): AppLocale | undefined {
    return value ? HOST_TO_APP_LOCALE[value] : undefined;
}

export function appLocaleToHost(locale: AppLocale): string {
    return APP_TO_HOST_LOCALE[locale];
}
