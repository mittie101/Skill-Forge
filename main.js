const { app, dialog } = require('electron');
const { createWindow, createSplash } = require('./main/window');
const { registerAllIpcHandlers } = require('./ipc/index');
const { getDb, closeDb } = require('./main/db/index');
const updater = require('./main/updater');

process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (app.isReady()) {
        dialog.showErrorBox('SkillForge — Unexpected Error', `An unhandled error occurred:\n\n${msg}`);
    } else {
        console.error('[SkillForge] Unhandled rejection before app ready:', msg);
    }
});

process.on('uncaughtException', (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (app.isReady()) {
        dialog.showErrorBox('SkillForge — Fatal Error', `An unexpected error occurred:\n\n${msg}`);
    } else {
        console.error('[SkillForge] uncaughtException before app ready:', msg);
    }
});

app.whenReady().then(() => {

    // Initialise DB — surface migration failures as a blocking error dialog
    try {
        getDb();
    } catch (err) {
        const version = err.migrationVersion ?? '?';
        dialog.showErrorBox(
            'SkillForge — Storage Error',
            `Migration failed at v${version}. Your existing data is safe.\n\nError: ${err.message}\n\nThe app will open but generation history will not be available.`
        );
    }

    registerAllIpcHandlers();
    updater.register();

    // Show splash while the main window loads — close on did-finish-load with a minimum display time
    const splash      = createSplash();
    const win         = createWindow({ show: false });
    const splashStart = Date.now();
    const MIN_SPLASH_MS = 1500;

    win.webContents.once('did-finish-load', () => {
        const elapsed   = Date.now() - splashStart;
        const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
        setTimeout(() => {
            if (!splash.isDestroyed()) splash.close();
            if (!win.isDestroyed())    win.show();
            updater.initUpdater(win);
        }, remaining);
    });

    // Fallback in case did-finish-load never fires
    setTimeout(() => {
        if (!splash.isDestroyed()) splash.close();
        if (!win.isDestroyed() && !win.isVisible()) win.show();
    }, 8000);
});

app.on('window-all-closed', () => {
    closeDb();
    if (process.platform !== 'darwin') app.quit();
});
