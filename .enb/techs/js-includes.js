/**
 * Техника создана на основе https://github.com/enb/enb-js
 * Изменения:
 *  - переработана почти полностью
 *  - изменен способ сборки (добавлены include)
 *  - добавлена минификация
 *  - кеш инвалидируется при изменении глобальных JS
 */

var fileList = require('enb/lib/file-list'),
    hash = require('object-hash'),
    path = require('path'),
    extend = require('util')._extend,
    fs = require('fs'),
    vow = require('vow'),
    vowFs = require('enb/lib/fs/async-fs'),
    glob = require('glob'),
    uglifyJs = null;


module.exports = require('enb/lib/build-flow').create()
    .name('js-includes')
    .target('target', '?.js')
    .defineOption('globals', [])// Список файлов, подключаемых в начало собранного JS-файла. Пути могут быть абсолютными или относительными к корню сборки
    .defineOption('minify', false) // Сжимать каждый JS перед объединением (после объединения это невозможно, т.к. теряются пути к исходным файлам)
    .defineOption('uglifyjs', {}) // https://www.npmjs.com/package/uglify-js#usage
    .useFileList(['js'])
    .saveCache(function (cache) {
        cache.set('options', this._optionsHash());
        cache.cacheFileList('globals', this._globalsFileList());
    })
    .needRebuild(function (cache) {
        try {
            return this._optionsHash() !== cache.get('options') ||
                cache.needRebuildFileList('globals', this._globalsFileList());
        } catch (e) {
            return true;
        }
    })
    .builder(function (sourceFiles) {
        var _this = this;

        var globalPromises = this._globals.map(function (sourceFile) {
            var relativePath = _this.node.relativePath(sourceFile);

            return vowFs.read(sourceFile, 'utf8')
                .then(function (raw) {
                    var pre = '\n/* begin: ' + relativePath + ' */\n',
                        post = '\n/* end: ' + relativePath + ' */\n',
                        result = pre + raw.trim() + ';' + post;

                    result = _this._minifyJs(result);
                    result = _this._processIncludes(result, sourceFile);

                    return result;
                });
        });

        var promises = sourceFiles.map(function (file) {
            var sourceFile = file.fullname,
                relativePath = _this.node.relativePath(sourceFile);

            return vowFs.read(sourceFile, 'utf8')
                .then(function (raw) {
                    var pre = '\n/* begin: ' + relativePath + ' */\n',
                        post = '\n/* end: ' + relativePath + ' */\n',
                        result = pre + raw.trim() + ';' + post;

                    result = _this._minifyJs(result);
                    result = _this._processIncludes(result, sourceFile);

                    return result;
                });
        });

        return vow.all([].concat(globalPromises, promises)).then(function (contents) {
            if (_this._minify) {
                contents = contents.map(function (item) {
                    return item.trim();
                });
            }

            return contents.join('\n');
        });
    })
    .methods({
        /**
         * Минификация JS
         */
        _minifyJs: function (data) {
            if (this._minify !== true) {
                return data;
            }

            if (null === uglifyJs) {
                uglifyJs = require('uglify-js');
            }

            var overrideOptions = {
                fromString: true,
                output: {
                    comments: /(^=include |^=require |^!\s|@preserve\s|@license\s|@cc_on\s)/
                }
            };
            var uglifyJsOptions = extend(extend({}, this._uglifyjs), overrideOptions);


            return uglifyJs.minify(data, uglifyJsOptions).code;
        },

        /**
         * Обработка include-инструкций
         * Взято из https://github.com/wiledal/gulp-include/blob/master/index.js и переписано
         */
        _processIncludes: function (content, sourceFile) {
            var includedFiles = [];

            function includeJs(content, sourceFile) {
                var matches = content.match(/^(\s+)?(\/\/|\/\*|\#|\<\!\-\-)(\s+)?=(\s+)?(include|require)(.+$)/mg);
                var relativeBasePath = path.dirname(sourceFile);

                if (!matches) return content;

                for (var i = 0; i < matches.length; i++) {
                    // Remove beginnings, endings and trim.
                    var includeCommand = matches[i]
                        .replace(/(\s+)/gi, " ")
                        .replace(/(\/\/|\/\*|\#)(\s+)?=(\s+)?/g, "")
                        .replace(/(\*\/)$/gi, "")
                        .replace(/['"]/g, "")
                        .trim();
                    var split = includeCommand.split(" ");

                    // Split the directive and the path
                    var includeType = split[0];
                    var includePath = relativeBasePath + "/" + split[1];

                    // Use glob for file searching
                    var fileMatches = glob.sync(includePath, {mark: true});
                    var replaceContent = '';
                    for (var y = 0; y < fileMatches.length; y++) {
                        var globbedFilePath = fileMatches[y];

                        // If directive is of type "require" and file already included, skip to next.
                        if (includeType == "require" && includedFiles.indexOf(globbedFilePath) > -1) continue;

                        // Get file contents and apply recursive include on result
                        var fileContents = fs.readFileSync(globbedFilePath);

                        var resultContent = includeJs(fileContents.toString(), globbedFilePath);

                        if (includedFiles.indexOf(globbedFilePath) == -1) includedFiles.push(globbedFilePath);

                        // If the last file did not have a line break, and it is not the last file in the matched glob,
                        // add a line break to the end
                        if (!resultContent.trim().match(/\n$/) && y != fileMatches.length - 1) {
                            resultContent += "\n";
                        }

                        replaceContent += resultContent;
                    }

                    // REPLACE
                    if (replaceContent.length) {
                        content = content.replace(matches[i], function () {
                            return replaceContent
                        });
                    }
                }

                return content;
            }

            return includeJs(content, sourceFile);
        },

        /**
         * Возвращает список объектов с информацией о глобально подключаемых JS-файлах
         * Используется для валидации кеша
         */
        _globalsFileList: function () {
            return this._globals.map(function (filename) {
                var absolutePath = path.resolve(process.cwd(), filename);

                return fileList.getFileInfo(absolutePath);
            });
        },

        /**
         * Возвращает хеш настроек технологии
         * Используется для валидации кеша
         */
        _optionsHash: function () {
            return hash(JSON.stringify({
                minify: this._minify,
                uglifyjs: this._uglifyjs
            }));
        }
    })
    .createTech();
