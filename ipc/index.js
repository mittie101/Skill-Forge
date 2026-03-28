'use strict';

const apiKeys  = require('./api-keys');
const settings = require('./settings');
const history  = require('./history');
const file     = require('./file');
const generate = require('./generate');
const build    = require('./build');
const install  = require('./install');
const review   = require('./review');
const openclaw = require('./openclaw');

function registerAllIpcHandlers() {
    apiKeys.register();
    settings.register();
    history.register();
    file.register();
    generate.register();
    build.register();
    install.register();
    review.register();
    openclaw.register();
}

module.exports = { registerAllIpcHandlers };
