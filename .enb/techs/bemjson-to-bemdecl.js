/**
 * Техника создана на основе https://github.com/enb/enb-bem-techs
 * Изменения:
 *  - кеш зависит от bemjson-файлов включенных в основной через require
 */

var inherit = require('inherit'),
    originalBemjsonToBemdecl = require('enb-bem-techs').bemjsonToBemdecl,
    fileList = require('enb/lib/file-list'),
    path = require('path'),
    fs = require('fs'),
    clearRequire = require('clear-require'),
    precinct = null;

module.exports = inherit(originalBemjsonToBemdecl, {
    build: function () {
        var cache = this.node.getNodeCache(this._target),
            bemjsonFilename = this.node.resolvePath(this._sourceTarget);

        var cachedDependencies = this._dependenciesFileListFromCache(cache.get('dependencies'));
        if (cache.needRebuildFileList('dependencies', cachedDependencies)) {
            // Хак.
            // Необходим для того, чтобы все последующие техники перечитали главный bemjson заново
            // Обычной инвалидации bemjson в текущем ключе кеша почему-то недостаточно.
            var now = new Date();
            cachedDependencies.forEach(function (info) {
                fs.utimesSync(info.fullname, now, now);
                clearRequire(info.fullname);
            });

            fs.utimesSync(bemjsonFilename, now, now);
            clearRequire(bemjsonFilename);
        }

        var result = this.__base();

        var dependenciesFromBemJson = this._allBemJsonDependenciesFileList(bemjsonFilename);
        cache.cacheFileList('dependencies', dependenciesFromBemJson);

        return result;
    },

    /**
     * Вычисляет текущие данные о закешированных файлах
     * Используется для валидации кеша
     */
    _dependenciesFileListFromCache: function (cachedFileList) {
        cachedFileList = cachedFileList || [];

        var dependenciesFileList = cachedFileList.filter(function (fileInfo) {
            try {
                var stat = fs.statSync(fileInfo.fullname);

                return stat.isFile();
            } catch (e) {
                return false;
            }
        }).map(function (fileInfo) {
            return fileList.getFileInfo(fileInfo.fullname);
        });

        return dependenciesFileList;
    },

    /**
     * Возвращет список объектов описывающих bemjson-файлы от которых зависит текущий собираемый bemjson
     */
    _allBemJsonDependenciesFileList: function (targetFile) {
        var dependencies = this._allBemJsonDependencies(targetFile);
        var dependenciesFileList = dependencies.map(function (filename) {
            return fileList.getFileInfo(filename);
        });

        return dependenciesFileList;
    },

    /**
     * Возвращает уникальный список bemjson-файлов от которых зависит текущий собираемый bemjson
     */
    _allBemJsonDependencies: function (targetFile) {
        var checkQueue = [targetFile],
            dependencyList = [],
            currentFile, currentDependencies;

        while (checkQueue.length > 0) {
            currentFile = checkQueue.shift();

            if (dependencyList.indexOf(currentFile) >= 0) {
                continue;
            }

            dependencyList.push(currentFile);
            currentDependencies = this._bemJsonDependencies(currentFile);
            checkQueue = checkQueue.concat(currentDependencies);
        }

        return dependencyList;
    },

    /**
     * Вычисляет зависимости bemjson-файла на 1 уровень
     */
    _bemJsonDependencies: function (targetFile) {
        if (null === precinct) {
            precinct = require('precinct');
        }

        var deps = precinct.paperwork(targetFile, {includeCore: false});
        deps = deps.filter(function (dependsOnFile) {
            return dependsOnFile.endsWith('.bemjson.js') || dependsOnFile.endsWith('.bemjson');
        });

        var paths = deps.map(function (dependsOnFile) {
            return path.resolve(path.dirname(targetFile), dependsOnFile);
        });

        return paths;
    }
});
