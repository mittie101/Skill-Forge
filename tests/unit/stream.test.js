'use strict';

const { apiErrorCode } = require('../../main/stream');

describe('apiErrorCode', () => {
    it('returns api_401 for 401', () => {
        const err = new Error('Unauthorized');
        err.statusCode = 401;
        expect(apiErrorCode(err)).toBe('api_401');
    });

    it('returns api_429 for 429', () => {
        const err = new Error('Rate limited');
        err.statusCode = 429;
        expect(apiErrorCode(err)).toBe('api_429');
    });

    it('returns api_5xx for 500', () => {
        const err = new Error('Internal error');
        err.statusCode = 500;
        expect(apiErrorCode(err)).toBe('api_5xx');
    });

    it('returns api_5xx for 502', () => {
        const err = new Error('Bad gateway');
        err.statusCode = 502;
        expect(apiErrorCode(err)).toBe('api_5xx');
    });

    it('returns api_5xx for 503', () => {
        const err = new Error('Service unavailable');
        err.statusCode = 503;
        expect(apiErrorCode(err)).toBe('api_5xx');
    });

    it('returns network_error for 404', () => {
        const err = new Error('Not found');
        err.statusCode = 404;
        expect(apiErrorCode(err)).toBe('network_error');
    });

    it('returns network_error for 400', () => {
        const err = new Error('Bad request');
        err.statusCode = 400;
        expect(apiErrorCode(err)).toBe('network_error');
    });

    it('returns network_error when statusCode is undefined', () => {
        const err = new Error('Network failed');
        expect(apiErrorCode(err)).toBe('network_error');
    });

    it('returns network_error for plain object with no statusCode', () => {
        expect(apiErrorCode({})).toBe('network_error');
    });

    it('retryable codes are api_429, api_5xx, network_error', () => {
        const retryable = ['api_429', 'api_5xx', 'network_error'];
        const nonRetryable = ['api_401'];

        const cases = [
            [{ statusCode: 429 }, true],
            [{ statusCode: 500 }, true],
            [{ statusCode: 503 }, true],
            [{},                  true],
            [{ statusCode: 401 }, false],
        ];

        const RETRYABLE = new Set(['api_429', 'api_5xx', 'network_error']);
        for (const [err, expected] of cases) {
            expect(RETRYABLE.has(apiErrorCode(err))).toBe(expected);
        }
    });
});
