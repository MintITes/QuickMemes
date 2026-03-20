import { AnimatePresence } from 'framer-motion';
import { useUiStore } from '../../stores/UiStore';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Gallery } from './Gallery';
import { StatusBar } from './StatusBar';
import { ToastContainer } from './ToastContainer';
import { Inspector } from './Inspector';
import { SettingsModal } from '../settings/SettingsModal';
import { ImportModal } from '../settings/ImportModal';
import { NotificationPanel } from './NotificationPanel';
import { UrlImportDialog } from '../common/UrlImportDialog';
import { AdvancedSearchDialog } from '../common/AdvancedSearchDialog';
import { ContextMenu } from '../meme/ContextMenu';
import { Lightbox } from '../meme/Lightbox';

export function MainShell() {
    const isPanelOpen = useUiStore(state => state.isPanelOpen);
    const isSettingsOpen = useUiStore(state => state.isSettingsOpen);
    const isImportModalOpen = useUiStore(state => state.isImportModalOpen);
    const isUrlImportDialogOpen = useUiStore(state => state.isUrlImportDialogOpen);
    const isAdvancedSearchOpen = useUiStore(state => state.isAdvancedSearchOpen);

    return (
        <div className="w-screen h-screen flex flex-col bg-bgPrimary text-textPrimary overflow-hidden font-sans">
            <Header />
            <div className="flex flex-1 overflow-hidden p-2 gap-2 bg-gradient-to-br from-black/[0.02] to-transparent dark:from-white/[0.02] dark:to-transparent">
                <Sidebar />
                <Gallery />
                <AnimatePresence>
                    {isPanelOpen && <Inspector key="inspector" />}
                </AnimatePresence>
            </div>
            <StatusBar />

            {/* Absolute positioning modals */}
            {isSettingsOpen && <SettingsModal />}
            {isImportModalOpen && <ImportModal />}
            {isUrlImportDialogOpen && <UrlImportDialog />}
            {isAdvancedSearchOpen && <AdvancedSearchDialog />}
            <NotificationPanel />
            <ToastContainer />

            <ContextMenu />
            <Lightbox />
        </div>
    );
}
