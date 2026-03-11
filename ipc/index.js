'use strict';

const apiKeys  = require('./api-keys');
const settings = require('./settings');
const history  = require('./history');
const file     = require('./file');
const generate = require('./generate');

function registerAllIpcHandlers() {
    apiKeys.register();
    settings.register();
    history.register();
    file.register();
    generate.register();
}

module.exports = { registerAllIpcHandlers };
