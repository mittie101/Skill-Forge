'use strict';

const { sanitise } = require('../../main/slug');

describe('sanitise', () => {
    it('lowercases input', () => {
        expect(sanitise('MySkill')).toBe('myskill');
    });

    it('replaces spaces with hyphens', () => {
        expect(sanitise('my skill')).toBe('my-skill');
    });

    it('collapses multiple spaces to single hyphen', () => {
        expect(sanitise('my  skill')).toBe('my-skill');
    });

    it('removes non-alphanumeric non-hyphen characters', () => {
        expect(sanitise('my_skill!')).toBe('myskill');
    });

    it('collapses multiple hyphens', () => {
        expect(sanitise('my--skill')).toBe('my-skill');
    });

    it('trims leading and trailing hyphens', () => {
        expect(sanitise('-my-skill-')).toBe('my-skill');
    });

    it('handles empty string', () => {
        expect(sanitise('')).toBe('skill');
    });

    it('handles null/undefined gracefully', () => {
        expect(sanitise(null)).toBe('skill');
        expect(sanitise(undefined)).toBe('skill');
    });

    it('appends -skill to Windows reserved name CON', () => {
        expect(sanitise('CON')).toBe('con-skill');
    });

    it('appends -skill to Windows reserved name NUL', () => {
        expect(sanitise('NUL')).toBe('nul-skill');
    });

    it('appends -skill to COM1', () => {
        expect(sanitise('COM1')).toBe('com1-skill');
    });

    it('appends -skill to LPT9', () => {
        expect(sanitise('LPT9')).toBe('lpt9-skill');
    });

    it('truncates to 80 characters', () => {
        const long = 'a'.repeat(100);
        expect(sanitise(long)).toHaveLength(80);
    });

    it('handles already-valid slug unchanged', () => {
        expect(sanitise('my-skill')).toBe('my-skill');
    });

    it('handles numbers in name', () => {
        expect(sanitise('skill2')).toBe('skill2');
    });

    it('handles mixed case with spaces and specials', () => {
        expect(sanitise('My Cool Skill! v2')).toBe('my-cool-skill-v2');
    });
});
