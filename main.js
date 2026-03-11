const { app, dialog } = require('electron');
const { createWindow } = require('./main/window');
const { registerAllIpcHandlers } = require('./ipc/index');
const { getDb, closeDb } = require('./main/db/index');

app.whenReady().then(() => {
    // Initialise DB — surface migration failures as a blocking error dialog
    let dbOk = true;
    try {
        getDb();
        console.log('[App] Database ready.');
    } catch (err) {
        dbOk = false;
        console.error('[App] DB init failed:', err.message);
        const version = err.migrationVersion ?? '?';
        dialog.showErrorBox(
            'SkillForge — Storage Error',
            `Migration failed at v${version}. Your existing data is safe.\n\nError: ${err.message}\n\nThe app will open but generation history will not be available.`
        );
    }

    registerAllIpcHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
    closeDb();
    if (process.platform !== 'darwin') app.quit();
});
