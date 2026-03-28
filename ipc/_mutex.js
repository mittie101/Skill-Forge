'use strict';

// Factory that creates an isolated mutex for guarding one async operation at a time.
function createMutex() {
    let _running    = false;
    let _aborted    = false;
    let _controller = null;

    return {
        get running()    { return _running; },
        get aborted()    { return _aborted; },
        get signal()     { return _controller?.signal ?? null; },
        get controller() { return _controller; },

        // Returns true if lock was acquired, false if already running.
        acquire() {
            if (_running) return false;
            _running    = true;
            _aborted    = false;
            _controller = new AbortController();
            return true;
        },

        // Signal abort — idempotent, safe to call multiple times.
        abort() {
            _aborted = true;
            _controller?.abort();
        },

        // Release lock and reset state.
        release() {
            _running    = false;
            _aborted    = false;
            _controller = null;
        },
    };
}

module.exports = { createMutex };
