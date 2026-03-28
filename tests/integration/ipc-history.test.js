'use strict';

jest.mock('electron');
jest.mock('../../main/db/history');

const { ipcMain } = require('electron');
const {
    listHistory,
    searchHistory,
    deleteHistory,
    getHistoryById,
    clearHistory,
    historyCount,
} = require('../../main/db/history');

beforeAll(() => {
    ipcMain._reset();
    require('../../ipc/history').register();
});

beforeEach(() => {
    jest.clearAllMocks();
});

function invoke(channel, ...args) {
    return ipcMain._invoke(channel, {}, ...args);
}

// ── list-history ──────────────────────────────────────────────────────────────

describe('list-history', () => {
    it('returns array from listHistory', async () => {
        listHistory.mockReturnValue([{ id: 1, skill_name: 'test-skill' }]);
        const result = await invoke('list-history', {});
        expect(result).toEqual([{ id: 1, skill_name: 'test-skill' }]);
        expect(listHistory).toHaveBeenCalledWith({});
    });

    it('passes framework filter option through', async () => {
        listHistory.mockReturnValue([]);
        await invoke('list-history', { framework: 'claude' });
        expect(listHistory).toHaveBeenCalledWith({ framework: 'claude' });
    });

    it('returns empty array when no history', async () => {
        listHistory.mockReturnValue([]);
        const result = await invoke('list-history', {});
        expect(result).toEqual([]);
    });
});

// ── search-history ────────────────────────────────────────────────────────────

describe('search-history', () => {
    it('calls searchHistory with trimmed query and framework', async () => {
        searchHistory.mockReturnValue([{ id: 2 }]);
        const result = await invoke('search-history', { query: '  python  ', framework: 'claude' });
        expect(searchHistory).toHaveBeenCalledWith('python', 'claude');
        expect(result).toEqual([{ id: 2 }]);
    });

    it('falls back to listHistory when query is empty string', async () => {
        listHistory.mockReturnValue([{ id: 3 }]);
        await invoke('search-history', { query: '', framework: 'chatgpt' });
        expect(listHistory).toHaveBeenCalledWith({ framework: 'chatgpt' });
        expect(searchHistory).not.toHaveBeenCalled();
    });

    it('falls back to listHistory when query is whitespace only', async () => {
        listHistory.mockReturnValue([]);
        await invoke('search-history', { query: '   ', framework: undefined });
        expect(listHistory).toHaveBeenCalled();
        expect(searchHistory).not.toHaveBeenCalled();
    });

    it('handles missing framework (treats as undefined → no filter)', async () => {
        listHistory.mockReturnValue([]);
        await invoke('search-history', { query: '' });
        expect(listHistory).toHaveBeenCalledWith({ framework: undefined });
    });

    it('handles missing payload gracefully', async () => {
        listHistory.mockReturnValue([]);
        const result = await invoke('search-history', undefined);
        expect(result).toBeDefined();
    });
});

// ── delete-history ────────────────────────────────────────────────────────────

describe('delete-history', () => {
    it('calls deleteHistory with numeric id and returns result', async () => {
        deleteHistory.mockReturnValue(true);
        const result = await invoke('delete-history', '42');
        expect(deleteHistory).toHaveBeenCalledWith(42);
        expect(result).toBe(true);
    });

    it('coerces string id to number', async () => {
        deleteHistory.mockReturnValue(false);
        await invoke('delete-history', '99');
        expect(deleteHistory).toHaveBeenCalledWith(99);
    });

    it('returns false when record not found', async () => {
        deleteHistory.mockReturnValue(false);
        const result = await invoke('delete-history', '9999');
        expect(result).toBe(false);
    });
});

// ── reopen-history ────────────────────────────────────────────────────────────

describe('reopen-history', () => {
    it('returns full row by id', async () => {
        const row = { id: 5, skill_name: 'my-skill', generated_md: '# content' };
        getHistoryById.mockReturnValue(row);
        const result = await invoke('reopen-history', '5');
        expect(getHistoryById).toHaveBeenCalledWith(5);
        expect(result).toEqual(row);
    });

    it('returns null when row not found', async () => {
        getHistoryById.mockReturnValue(null);
        const result = await invoke('reopen-history', '9999');
        expect(result).toBeNull();
    });
});

// ── clear-all-history ─────────────────────────────────────────────────────────

describe('clear-all-history', () => {
    it('clears all history and returns count of deleted rows', async () => {
        clearHistory.mockReturnValue(42);
        const result = await invoke('clear-all-history');
        expect(clearHistory).toHaveBeenCalled();
        expect(result).toBe(42);
    });

    it('returns 0 when already empty', async () => {
        clearHistory.mockReturnValue(0);
        const result = await invoke('clear-all-history');
        expect(result).toBe(0);
    });
});

// ── history-count ─────────────────────────────────────────────────────────────

describe('history-count', () => {
    it('returns total count', async () => {
        historyCount.mockReturnValue(17);
        const result = await invoke('history-count');
        expect(result).toBe(17);
    });

    it('returns 0 when empty', async () => {
        historyCount.mockReturnValue(0);
        const result = await invoke('history-count');
        expect(result).toBe(0);
    });
});
