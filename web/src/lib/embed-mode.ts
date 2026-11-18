// 嵌入模式：宿主平台（GlowPix）以 iframe 嵌入时隐藏自带侧栏，由宿主侧栏替代。
// URL 参数 embed=1 触发，sessionStorage 持久化以覆盖应用内跳转与整页刷新。
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
