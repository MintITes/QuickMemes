import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Gallery } from './Gallery';
import { Inspector } from './Inspector';
import { StatusBar } from './StatusBar';
import { SettingsModal } from '../settings/SettingsModal';
import { ImportModal } from '../settings/ImportModal';
import { NotificationPanel } from './NotificationPanel';
import { UrlImportDialog } from '../common/UrlImportDialog';
import { AdvancedSearchDialog } from '../common/AdvancedSearchDialog';
import { ToastContainer } from './ToastContainer';
import { AnimatePresence } from 'framer-motion';
import { useUiStore } from '../../stores/UiStore';

export function MainShell() {
    const isPanelOpen = useUiStore(state => state.isPanelOpen);

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
            <SettingsModal />
            <ImportModal />
            <UrlImportDialog />
            <AdvancedSearchDialog />
            <NotificationPanel />
            <ToastContainer />
        </div>
    );
}
