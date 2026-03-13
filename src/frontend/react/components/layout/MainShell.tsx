import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Gallery } from './Gallery';
import { Inspector } from './Inspector';
import { StatusBar } from './StatusBar';
import { SettingsModal } from '../settings/SettingsModal';
import { ImportModal } from '../settings/ImportModal';

export function MainShell() {
    return (
        <div className="w-screen h-screen flex flex-col bg-bgPrimary text-textPrimary overflow-hidden font-sans">
            <Header />
            <div className="flex flex-1 overflow-hidden p-2 gap-2 bg-gradient-to-br from-black/[0.02] to-transparent dark:from-white/[0.02] dark:to-transparent">
                <Sidebar />
                <Gallery />
                <Inspector />
            </div>
            <StatusBar />

            {/* Absolute positioning modals */}
            <SettingsModal />
            <ImportModal />
        </div>
    );
}
