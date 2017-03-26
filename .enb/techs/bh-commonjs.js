/**
 * Техника создана на основе https://github.com/enb/enb-bh
 * Изменения:
 *  - кеш зависит не только от опции bh-file но и от bhOptions
 */

var inherit = require('inherit'),
    originalBhСommonjs = require('enb-bh/techs/bh-commonjs'),
    hash = require('object-hash');

module.exports = inherit(originalBhСommonjs, {
    __cacheValidator: function (cache) {
        return cache.needRebuildFile('bh-file', this._bhFilename) || this.__optionsHash() !== cache.get('options');
    },
    __cacheSaver: function (cache) {
        cache.cacheFileInfo('bh-file', this._bhFilename);
        cache.set('options', this.__optionsHash());
    },
    __optionsHash: function () {
        return hash(JSON.stringify({
            bhFilename: this._bhFilename,
            bhOptions: this._bhOptions
        }));
    },
});
