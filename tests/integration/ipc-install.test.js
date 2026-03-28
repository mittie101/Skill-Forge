'use strict';

jest.mock('electron');
jest.mock('fs');

const { ipcMain, shell } = require('electron');
const fs                 = require('fs');
const os                 = require('os');
const path               = require('path');

// ── Fixtures ──

const VALID_MD = `---
name: my-skill
description: A test skill for install tests.
---

## When to Use

When you need to do X.

## Instructions

Follow these steps.

## Expected Outputs

A result.

## Hard Rules

Never skip validation.

## Edge Cases

Handle empty input.
`.replace(/\n/g, '\n');

const VALID_PATH = path.join('C:', 'Users', 'test', 'skills', 'my-skill.md');

// ── Setup ──

beforeAll(() => {
    ipcMain._reset();
    require('../../ipc/install').register();
});

beforeEach(() => {
    jest.clearAllMocks();

    // Default fs behaviour: stat succeeds (small file), read returns VALID_MD
    fs.statSync.mockReturnValue({ size: 500 });
    fs.readFileSync.mockReturnValue(VALID_MD);
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    fs.renameSync.mockImplementation(() => {});
    fs.unlinkSync.mockImplementation(() => {});
    fs.readdirSync.mockReturnValue([]);
});

function invoke(channel, ...args) {
    return ipcMain._invoke(channel, { sender: {} }, ...args);
}

// ─────────────────────────────────────────────────────────────────────────────
// install-load-file
// ─────────────────────────────────────────────────────────────────────────────

describe('install-load-file', () => {
    it('returns invalid_path for non-string argument', async () => {
        const r = await invoke('install-load-file', 42);
        expect(r.error).toBe('invalid_path');
    });

    it('returns invalid_extension for a non-.md file', async () => {
        const r = await invoke('install-load-file', 'C:\\path\\to\\script.py');
        expect(r.error).toBe('invalid_extension');
        expect(fs.statSync).not.toHaveBeenCalled();
    });

    it('returns invalid_extension for a .txt file', async () => {
        const r = await invoke('install-load-file', 'C:\\path\\to\\notes.txt');
        expect(r.error).toBe('invalid_extension');
    });

    it('returns error code when stat fails (file not found)', async () => {
        fs.statSync.mockImplementationOnce(() => { const e = new Error(); e.code = 'ENOENT'; throw e; });
        const r = await invoke('install-load-file', VALID_PATH);
        expect(r.error).toBe('ENOENT');
    });

    it('returns TOO_LARGE for files over 1 MB', async () => {
        fs.statSync.mockReturnValueOnce({ size: 1024 * 1024 + 1 });
        const r = await invoke('install-load-file', VALID_PATH);
        expect(r.error).toBe('TOO_LARGE');
    });

    it('returns ok:true for a valid .md file', async () => {
        const r = await invoke('install-load-file', VALID_PATH);
        expect(r.ok).toBe(true);
        expect(r.name).toBe('my-skill');
        expect(r.safeName).toBe('my-skill');
        expect(r.filePath).toBe(VALID_PATH);
    });

    it('extracts name from frontmatter', async () => {
        const r = await invoke('install-load-file', VALID_PATH);
        expect(r.name).toBe('my-skill');
    });

    it('falls back to filename when no frontmatter name', async () => {
        fs.readFileSync.mockReturnValueOnce('# No frontmatter\n\nJust body.');
        const filePath = path.join('C:', 'skills', 'fallback-skill.md');
        const r = await invoke('install-load-file', filePath);
        expect(r.ok).toBe(true);
        expect(r.name).toBe('fallback-skill');
    });

    it('sets warnNoSections:true when body has no recognised sections', async () => {
        fs.readFileSync.mockReturnValueOnce('---\nname: bare\n---\n\nJust a body with no sections.');
        const r = await invoke('install-load-file', VALID_PATH);
        expect(r.ok).toBe(true);
        expect(r.warnNoSections).toBe(true);
    });

    it('sets warnNoSections:false when at least one section is found', async () => {
        const r = await invoke('install-load-file', VALID_PATH);
        expect(r.warnNoSections).toBe(false);
    });

    it('strips BOM from file content', async () => {
        fs.readFileSync.mockReturnValueOnce('\uFEFF' + VALID_MD);
        const r = await invoke('install-load-file', VALID_PATH);
        expect(r.ok).toBe(true);
        expect(r.name).toBe('my-skill');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// install-skill (skill mode)
// ─────────────────────────────────────────────────────────────────────────────

describe('install-skill — skill mode', () => {
    it('returns ok:true and correct install path for skill mode', async () => {
        const r = await invoke('install-skill', { filePath: VALID_PATH, modeSkill: true });
        expect(r.ok).toBe(true);
        expect(r.installPath).toContain(path.join('.claude', 'skills', 'my-skill', 'SKILL.md'));
        expect(r.command).toBe('/my-skill');
    });

    it('calls mkdirSync to create the directory', async () => {
        await invoke('install-skill', { filePath: VALID_PATH, modeSkill: true });
        expect(fs.mkdirSync).toHaveBeenCalledWith(
            expect.stringContaining(path.join('.claude', 'skills', 'my-skill')),
            { recursive: true }
        );
    });

    it('writes the file atomically (writeFileSync then renameSync)', async () => {
        await invoke('install-skill', { filePath: VALID_PATH, modeSkill: true });
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(fs.renameSync).toHaveBeenCalled();
    });

    it('returns EEXIST when file already exists', async () => {
        fs.existsSync.mockReturnValueOnce(true);
        const r = await invoke('install-skill', { filePath: VALID_PATH, modeSkill: true });
        expect(r.error).toBe('EEXIST');
        expect(r.installPath).toBeTruthy();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('re-parses the file at install time (does not trust renderer state)', async () => {
        // Simulate renderer passing a stale filePath — install-skill re-reads from disk
        await invoke('install-skill', { filePath: VALID_PATH, modeSkill: true });
        expect(fs.readFileSync).toHaveBeenCalledWith(VALID_PATH, { encoding: 'utf8' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// install-skill (command mode)
// ─────────────────────────────────────────────────────────────────────────────

describe('install-skill — command mode', () => {
    it('returns ok:true and correct install path for command mode', async () => {
        const r = await invoke('install-skill', { filePath: VALID_PATH, modeSkill: false });
        expect(r.ok).toBe(true);
        expect(r.installPath).toContain(path.join('.claude', 'commands', 'my-skill.md'));
        expect(r.command).toBe('/user:my-skill');
    });

    it('does NOT create a sub-directory in commands mode', async () => {
        await invoke('install-skill', { filePath: VALID_PATH, modeSkill: false });
        // mkdirSync is called but with the commands/ dir directly, not a sub-dir
        expect(fs.mkdirSync).toHaveBeenCalledWith(
            expect.stringContaining(path.join('.claude', 'commands')),
            { recursive: true }
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// install-skill-overwrite
// ─────────────────────────────────────────────────────────────────────────────

describe('install-skill-overwrite', () => {
    it('returns ok:true even when file already exists (overwrites)', async () => {
        // existsSync would return true in a real overwrite scenario, but the overwrite
        // handler skips the collision check — it always writes
        const r = await invoke('install-skill-overwrite', { filePath: VALID_PATH, modeSkill: true });
        expect(r.ok).toBe(true);
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(fs.renameSync).toHaveBeenCalled();
    });

    it('returns correct command for skill mode', async () => {
        const r = await invoke('install-skill-overwrite', { filePath: VALID_PATH, modeSkill: true });
        expect(r.command).toBe('/my-skill');
    });

    it('returns correct command for command mode', async () => {
        const r = await invoke('install-skill-overwrite', { filePath: VALID_PATH, modeSkill: false });
        expect(r.command).toBe('/user:my-skill');
    });

    it('propagates load errors (e.g. non-.md path)', async () => {
        const r = await invoke('install-skill-overwrite', { filePath: 'bad.txt', modeSkill: true });
        expect(r.error).toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// install-preview-path
// ─────────────────────────────────────────────────────────────────────────────

describe('install-preview-path', () => {
    const HOME = os.homedir();

    it('returns skill mode path', async () => {
        const r = await invoke('install-preview-path', { safeName: 'my-skill', modeSkill: true });
        expect(r).toBe(path.join(HOME, '.claude', 'skills', 'my-skill', 'SKILL.md'));
    });

    it('returns command mode path', async () => {
        const r = await invoke('install-preview-path', { safeName: 'my-skill', modeSkill: false });
        expect(r).toBe(path.join(HOME, '.claude', 'commands', 'my-skill.md'));
    });

    it('sanitises renderer-supplied safeName (path traversal prevention)', async () => {
        // A name with traversal chars gets sanitised to a safe equivalent
        const r = await invoke('install-preview-path', { safeName: '../../../evil', modeSkill: false });
        // Should not contain '..' in the resulting path beyond the home dir
        expect(typeof r).toBe('string');
        expect(r).not.toContain('..');
    });

    it('sanitises safeName with spaces', async () => {
        const r = await invoke('install-preview-path', { safeName: 'my skill', modeSkill: true });
        // Spaces become hyphens in safe name
        expect(r).toContain('my-skill');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// install-open-folder
// ─────────────────────────────────────────────────────────────────────────────

describe('install-open-folder', () => {
    it('calls shell.openPath with the correct skills folder', async () => {
        await invoke('install-open-folder', { safeName: 'my-skill', modeSkill: true });
        expect(shell.openPath).toHaveBeenCalledWith(
            expect.stringContaining(path.join('.claude', 'skills', 'my-skill'))
        );
    });

    it('calls shell.openPath with the commands folder for command mode', async () => {
        await invoke('install-open-folder', { safeName: 'my-skill', modeSkill: false });
        expect(shell.openPath).toHaveBeenCalledWith(
            expect.stringContaining(path.join('.claude', 'commands'))
        );
    });

    it('returns ok:true on success', async () => {
        shell.openPath.mockResolvedValueOnce(''); // empty string = no error
        const r = await invoke('install-open-folder', { safeName: 'my-skill', modeSkill: true });
        expect(r.ok).toBe(true);
    });

    it('re-validates safeName before building path (traversal prevention)', async () => {
        // '../../../evil' sanitises to 'evil' (or similar safe form)
        const r = await invoke('install-open-folder', { safeName: '../../../evil', modeSkill: false });
        const calledPath = shell.openPath.mock.calls[0]?.[0] ?? '';
        expect(calledPath).not.toContain('..');
        expect(r.ok).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// list-installed-skills
// ─────────────────────────────────────────────────────────────────────────────

describe('list-installed-skills', () => {
    it('returns empty array when .claude directories do not exist', async () => {
        fs.existsSync.mockReturnValue(false);
        const r = await invoke('list-installed-skills');
        expect(Array.isArray(r)).toBe(true);
        expect(r).toHaveLength(0);
    });

    it('lists .md files from the commands directory', async () => {
        fs.existsSync.mockImplementation((p) => {
            // commands dir exists, skills dir does not
            if (p.includes('commands')) return true;
            return false;
        });
        fs.readdirSync.mockReturnValue(['my-command.md', 'other.md', 'not-md.txt']);
        const r = await invoke('list-installed-skills');
        const commands = r.filter(x => x.type === 'command');
        expect(commands).toHaveLength(2);
        expect(commands[0].name).toBe('my-command');
        expect(commands[1].name).toBe('other');
    });

    it('lists skills (dirs with SKILL.md) from the skills directory', async () => {
        fs.existsSync.mockImplementation((p) => {
            // skills dir and SKILL.md files exist, commands dir does not
            if (p.includes('commands')) return false;
            if (p.includes('skills'))   return true;
            return false;
        });
        fs.readdirSync.mockReturnValue(['my-skill', 'another-skill']);
        const r = await invoke('list-installed-skills');
        const skills = r.filter(x => x.type === 'skill');
        expect(skills).toHaveLength(2);
        expect(skills[0].name).toBe('my-skill');
    });

    it('returns combined commands and skills', async () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockImplementation((dir) => {
            if (dir.includes('commands')) return ['cmd.md'];
            if (dir.includes('skills'))   return ['my-skill'];
            return [];
        });
        const r = await invoke('list-installed-skills');
        expect(r.some(x => x.type === 'command')).toBe(true);
        expect(r.some(x => x.type === 'skill')).toBe(true);
    });

    it('caps results at 200 entries', async () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockImplementation((dir) => {
            if (dir.includes('commands')) return Array.from({ length: 150 }, (_, i) => `cmd${i}.md`);
            if (dir.includes('skills'))   return Array.from({ length: 100 }, (_, i) => `skill${i}`);
            return [];
        });
        const r = await invoke('list-installed-skills');
        expect(r.length).toBeLessThanOrEqual(200);
    });

    it('ignores non-.md files in commands directory', async () => {
        fs.existsSync.mockImplementation((p) => p.includes('commands'));
        fs.readdirSync.mockReturnValue(['valid.md', 'ignore.json', 'README.txt']);
        const r = await invoke('list-installed-skills');
        expect(r).toHaveLength(1);
        expect(r[0].name).toBe('valid');
    });
});
