'use strict';

const { sanitise } = require('../../main/slug');

describe('slug.sanitise', () => {
    test('lowercases input', () => {
        expect(sanitise('MySkill')).toBe('myskill');
    });

    test('replaces spaces with hyphens', () => {
        expect(sanitise('my skill name')).toBe('my-skill-name');
    });

    test('removes special characters', () => {
        expect(sanitise('skill!@#$%^&*()')).toBe('skill');
    });

    test('collapses multiple hyphens', () => {
        expect(sanitise('skill---name')).toBe('skill-name');
    });

    test('trims leading and trailing hyphens', () => {
        expect(sanitise('---skill---')).toBe('skill');
    });

    test('empty string returns "skill"', () => {
        expect(sanitise('')).toBe('skill');
    });

    test('null/undefined returns "skill"', () => {
        expect(sanitise(null)).toBe('skill');
        expect(sanitise(undefined)).toBe('skill');
    });

    test('whitespace-only returns "skill"', () => {
        expect(sanitise('   ')).toBe('skill');
    });

    test('Windows reserved name CON gets -skill suffix', () => {
        expect(sanitise('CON')).toBe('con-skill');
    });

    test('Windows reserved name NUL gets -skill suffix', () => {
        expect(sanitise('NUL')).toBe('nul-skill');
    });

    test('Windows reserved name PRN gets -skill suffix', () => {
        expect(sanitise('PRN')).toBe('prn-skill');
    });

    test('Windows reserved name COM1 gets -skill suffix', () => {
        expect(sanitise('COM1')).toBe('com1-skill');
    });

    test('Windows reserved name LPT9 gets -skill suffix', () => {
        expect(sanitise('LPT9')).toBe('lpt9-skill');
    });

    test('non-reserved name is not modified for reserved check', () => {
        expect(sanitise('connotation')).toBe('connotation');
    });

    test('truncates to 80 characters', () => {
        const long = 'a'.repeat(100);
        expect(sanitise(long)).toBe('a'.repeat(80));
    });

    test('truncates exactly at 80 chars after sanitisation', () => {
        const input = 'a'.repeat(79) + '!!!'; // special chars stripped → 79 a's
        expect(sanitise(input)).toHaveLength(79);
    });

    test('unicode non-ascii chars are stripped', () => {
        // em-dash is not a space so it is removed (not converted to hyphen)
        expect(sanitise('skill—fancy')).toBe('skillfancy');
    });

    test('numbers are preserved', () => {
        expect(sanitise('skill123')).toBe('skill123');
    });

    test('spaces become single hyphens even with multiple spaces', () => {
        expect(sanitise('skill   name')).toBe('skill-name');
    });
});
