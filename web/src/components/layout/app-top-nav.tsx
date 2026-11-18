import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { BannerAnnouncementsSlider } from "@/components/layout/banner-announcements-slider";
import { ModelSetupGuide } from "@/components/layout/model-setup-guide";
import { WorkspaceSidebarNav } from "@/components/layout/workspace-sidebar-nav";
import { readWorkspaceSidebarCollapsed, writeWorkspaceSidebarCollapsed } from "@/components/layout/workspace-sidebar-state";
import { WorkspaceTopBar } from "@/components/layout/workspace-top-bar";
import { WorkspaceTopBarExtensionProvider } from "@/components/layout/workspace-top-bar-extension";
import { WorkspaceStorageLimitNotice } from "@/components/layout/workspace-storage-limit-notice";
import { WorkspaceWalletHost } from "@/components/layout/workspace-wallet-modal";
import { GenerationSuccessNotifier } from "@/components/layout/generation-success-notifier";
import { useWorkspaceDocumentTitle } from "@/hooks/use-workspace-document-title";
import { embedParentOrigin, isEmbedMode } from "@/lib/embed-mode";
import { cn } from "@/lib/utils";
import { isSpatialWorkbenchPath } from "@/lib/workspace-routes";

const WorkspaceCommandPalette = lazy(() => import("@/components/layout/workspace-command-palette").then((module) => ({ default: module.WorkspaceCommandPalette })));

export function AppWorkspaceShell({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [mobileSidebarExpanded, setMobileSidebarExpanded] = useState(false);
    const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(readWorkspaceSidebarCollapsed);
    const [paletteOpen, setPaletteOpen] = useState(false);
    useWorkspaceDocumentTitle();

    const hideChrome = pathname.startsWith("/admin") || /^\/canvas\/[^/]+/.test(pathname);
    const showGlobalTopBar = !hideChrome;
    const spatialWorkbench = isSpatialWorkbenchPath(pathname);
    const creationWorkspace = pathname === "/" || pathname === "/create";
    // 嵌入模式：宿主平台提供侧栏，这里隐藏自带侧栏、保留顶栏。
    const embed = isEmbedMode();

    // 路由变化回传宿主，宿主侧栏高亮与浏览器前进/后退随之同步。
    useEffect(() => {
        if (!embed || window.parent === window) return;
        window.parent.postMessage({ source: "yingce-embed", path: pathname }, embedParentOrigin());
    }, [embed, pathname]);

    const isMobileViewport = () => window.innerWidth < 1024;

    const toggleSidebar = () => {
        if (isMobileViewport()) {
            setMobileSidebarExpanded((current) => !current);
            return;
        }
        setDesktopSidebarCollapsed((current) => {
            const next = !current;
            writeWorkspaceSidebarCollapsed(next);
            return next;
        });
    };

    const expandDesktopSidebar = () => {
        setDesktopSidebarCollapsed(false);
        writeWorkspaceSidebarCollapsed(false);
    };

    const collapseDesktopSidebar = () => {
        setDesktopSidebarCollapsed(true);
        writeWorkspaceSidebarCollapsed(true);
    };

    const handleNavClick = () => {
        if (isMobileViewport()) setMobileSidebarExpanded(false);
    };

    // ⌘K / Ctrl+K 全局呼出搜索面板。
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setPaletteOpen((open) => !open);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    useEffect(() => {
        const handleWorkspaceNavigation = (rawEvent: Event) => {
            const event = rawEvent as CustomEvent<{ to?: string }>;
            if (!event.detail?.to) return;
            event.preventDefault();
            navigate(event.detail.to);
        };
        window.addEventListener("workspace:navigate", handleWorkspaceNavigation);
        return () => window.removeEventListener("workspace:navigate", handleWorkspaceNavigation);
    }, [navigate]);

    return (
        <>
            <WorkspaceTopBarExtensionProvider>
                <div className={cn("app-workspace-shell flex h-dvh min-h-0 w-full flex-col overflow-hidden", spatialWorkbench && "is-spatial", creationWorkspace && "is-creation-workspace", embed && "is-embed")}>
                    {!hideChrome && !embed && mobileSidebarExpanded ? <button type="button" className="app-workspace-sidebar-scrim lg:hidden" aria-label={t("shell.collapseSidebar")} onClick={() => setMobileSidebarExpanded(false)} /> : null}

                    {showGlobalTopBar ? <BannerAnnouncementsSlider /> : null}

                    <div className="app-workspace-main-row flex min-h-0 min-w-0 flex-1 overflow-hidden">
                        {!hideChrome && !embed ? (
                            <aside
                                className={cn(
                                    "app-workspace-sidebar flex h-full shrink-0 flex-col overflow-hidden",
                                    mobileSidebarExpanded && "is-mobile-expanded",
                                    desktopSidebarCollapsed && "is-collapsed",
                                )}
                            >
                                <WorkspaceSidebarNav
                                    collapsed={desktopSidebarCollapsed}
                                    onNavigate={handleNavClick}
                                    onOpenSearch={() => setPaletteOpen(true)}
                                    onExpand={expandDesktopSidebar}
                                    onCollapse={collapseDesktopSidebar}
                                />
                            </aside>
                        ) : null}

                        <div className="app-workspace-stage relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                            {showGlobalTopBar ? <WorkspaceTopBar sidebarOpen={isMobileViewport() ? mobileSidebarExpanded : !desktopSidebarCollapsed} onToggleSidebar={toggleSidebar} /> : null}
                            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
                        </div>
                    </div>

                    {paletteOpen ? <Suspense fallback={null}><WorkspaceCommandPalette open onClose={() => setPaletteOpen(false)} /></Suspense> : null}
                </div>
            </WorkspaceTopBarExtensionProvider>
            <WorkspaceWalletHost />
            <WorkspaceStorageLimitNotice />
            <GenerationSuccessNotifier />
            <ModelSetupGuide hidden={pathname === "/login" || pathname === "/register" || pathname.startsWith("/admin")} />
        </>
    );
}
