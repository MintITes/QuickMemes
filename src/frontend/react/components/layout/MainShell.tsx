import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Gallery } from './Gallery';
import { Inspector } from './Inspector';
import { StatusBar } from './StatusBar';
import { SettingsModal } from '../settings/SettingsModal';

export function MainShell() {
    return (
        <div className="w-screen h-screen flex flex-col bg-bgPrimary text-textPrimary overflow-hidden font-sans">
            <Header />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <Gallery />
                <Inspector />
            </div>
            <StatusBar />

            {/* Absolute positioning modals */}
            <SettingsModal />
        </div>
    );
}
