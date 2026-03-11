const { safeStorage } = require('electron');

/**
 * Encrypt a plaintext API key using Electron safeStorage.
 * Returns a base64-encoded string suitable for persistence.
 * @param {string} plaintext
 * @returns {string} base64 ciphertext
 */
function encryptKey(plaintext) {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage encryption is not available on this system');
    }
    const buffer = safeStorage.encryptString(plaintext);
    return buffer.toString('base64');
}

/**
 * Decrypt a base64-encoded ciphertext back to the plaintext API key.
 * Returns null if decryption fails — never throws to caller.
 * @param {string} cipherBase64
 * @returns {string|null} plaintext or null on failure
 */
function decryptKey(cipherBase64) {
    try {
        if (!safeStorage.isEncryptionAvailable()) return null;
        const buffer = Buffer.from(cipherBase64, 'base64');
        return safeStorage.decryptString(buffer);
    } catch {
        return null;
    }
}

/**
 * Returns true if safeStorage is available on this machine.
 * @returns {boolean}
 */
function isEncryptionAvailable() {
    return safeStorage.isEncryptionAvailable();
}

module.exports = { encryptKey, decryptKey, isEncryptionAvailable };
