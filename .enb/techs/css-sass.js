/**
 * Техника создана на основе https://github.com/enb/enb-sass
 * Изменения:
 *  - переработана почти полностью
 *  - изменен способ компиляции (css и scss отдельно)
 *  - добавлены postCSS-фильтры для импортов, изменения относительных путей, добавления автопрефиксов, генерации спрайтов
 *  - добавлена минификация
 *  - кеш инвалидируется при изменении глобальных SCSS
 */

var fileList = require('enb/lib/file-list'),
    hash = require('object-hash'),
    path = require('path'),
    fs = require('fs'),
    extend = require('util')._extend,
    vow = require('vow'),
    vowFs = require('enb/lib/fs/async-fs'),
    sass = null,
    postcss = null,
    postcssImport = null,
    postcssUrl = null,
    autoprefixer = null,
    detectiveSass = null,
    easySprites = null,
    cleanCss = null,
    cssLint = null,
    cssLintRuleset = null;


module.exports = require('enb/lib/build-flow').create()
    .name('css-sass')
    .target('target', '?.css')
    .defineOption('sass', {}) // https://www.npmjs.com/package/node-sass#options
    .defineOption('responsive', false)// Переменная, передаваемая в sass (см. config.json в корне проекта)
    .defineOption('globals', [])// Список файлов, подключаемых в начало каждого SASS-файла. Пути могут быть абсолютными или относительными к корню сборки
    .defineOption('autoprefixer', {}) // https://www.npmjs.com/package/autoprefixer#options
    .defineOption('minify', false) // Сжимать результирующий css
    .defineOption('cleancss', {}) // https://www.npmjs.com/package/clean-css#how-to-use-clean-css-api
    .useFileList(['scss', 'css'])
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
        //var content = fs.readFileSync('/Users/alex/HDD/Develop/bem/3b-project-stub/bem/blocks.03-bootstrap/bootstrap/bootstrap.scss', 'utf8');
        //this._sassDependencies(content, '/Users/alex/HDD/Develop/bem/3b-project-stub/bem/blocks.03-bootstrap/bootstrap/bootstrap.scss');
        if (null === postcss) {
            postcss = require('postcss');
        }

        if (null === postcssImport) {
            postcssImport = require('postcss-import');
        }

        if (null === postcssUrl) {
            postcssUrl = require('postcss-url');
        }

        if (null === autoprefixer) {
            autoprefixer = require('autoprefixer');
        }

        if (this._minify && null === easySprites) {
            easySprites = require('postcss-easysprites');
        }

        if (this._minify && null === cleanCss) {
            cleanCss = require('clean-css');
        }

        // if (null === cssLint) {
        //     cssLint = require('csslint').CSSLint;
        //
        //     cssLintRuleset = {};
        //     cssLint.getRules().forEach(function(rule) {
        //       cssLintRuleset[rule.id] = 1;
        //     });
        // }

        var _this = this,
            targetFile = _this.node.resolvePath(path.basename(this._target)),
            sassResponsive = '$responsive: ' + _this._responsive + ';\n',
            sassGlobalImports = _this._sassGlobalsImports();

        var promises = _this._filterSourceFiles(sourceFiles).map(function (file) {
            var sourceFile = file.fullname,
                relativePath = _this.node.relativePath(sourceFile);

            return vowFs.read(sourceFile, 'utf8')
                .then(function (raw) {
                    if (file.suffix === 'css') {
                        return _this._combineCss(raw, sourceFile, targetFile);
                    } else {
                        return _this._buildSass(sassResponsive + sassGlobalImports + raw, sourceFile, targetFile);
                    }
                })
                .then(function (css) {
                    return _this._rebaseAndMagic(css, sourceFile, targetFile);
                })
                .then(function (css) {
                    var pre = '\n/* begin: ' + relativePath + ' */\n',
                        post = '\n/* end: ' + relativePath + ' */\n';
                    return pre + css.trim() + post;
                });
        });

        return vow.all(promises).then(function (contents) {
            var result = contents.join('\n');

            // var lintResult = cssLint.verify(result, cssLintRuleset);
            // lintResult.messages.forEach(function(message) {
            //     var description = 'css-lint ' + message.type + ' in ' + targetFile;
            //
            //     if (message.line && message.col)
            //         description += ':' + message.line + ':' + message.col;
            //
            //     description += '\n\t' + '[' + message.rule.id + ']: ' + message.message
            //
            //     if (message.evidence)
            //         description += '\n\t' + message.evidence;
            //     console.warn(description);
            // });

            return _this._minifyCss(result);
        });
    })
    .methods({
        /**
         * Сборка CSS-файла
         */
        _combineCss: function (data, sourceFile) {
            var deferred = vow.defer(),
                processor = postcss();

            processor.use(postcssImport());
            processor.use(postcssUrl());

            processor.process(data, {
                from: sourceFile,
                to: sourceFile
            }).then(function (result) {
                result.warnings().forEach(function (warn) {
                    console.warn(warn.toString());
                });
                deferred.resolve(result.css);
            }).catch(function (error) {
                deferred.reject(error);
            });

            return deferred.promise();
        },

        /**
         * Сборка SASS-файла
         */
        _buildSass: function (data, sourceFile) {
            if (null === sass) {
                sass = require('node-sass');
            }

            var deferred = vow.defer(),
                sassOptions = extend(extend({}, this._sass), {
                    data: data,
                    includePaths: [path.dirname(sourceFile)]
                });

            sass.render(sassOptions, function (buildError, buildResult) {
                if (buildError) {
                    var message = buildError.message;

                    if (buildError.formatted !== undefined) {
                        message = buildError.formatted;
                    }

                    message = message
                        .replace('Error: ', '')
                        .replace(' of stdin', ' of file ' + path.relative(process.cwd(), sourceFile))
                        .replace('Invalid UTF-8', 'Invalid UTF-8: ' + path.relative(process.cwd(), sourceFile));

                    console.log(sourceFile);
                    console.log(buildError);
                    deferred.reject(new Error(message));
                } else {
                    deferred.resolve(buildResult.css);
                }
            });

            return deferred.promise();
        },

        /**
         * Изменение адресов с учетом местоположения результирующего CSS-файла
         * Применение браузерных префиксов
         * Подключение шрифтов
         */
        _rebaseAndMagic: function (data, sourceFile, targetFile) {
            var deferred = vow.defer(),
                processor = postcss(),
                autoprefixerOptions = extend({}, this._autoprefixer);

            processor.use(postcssUrl());
            processor.use(autoprefixer(autoprefixerOptions));


            processor.process(data, {
                from: sourceFile,
                to: targetFile
            }).then(function (result) {
                result.warnings().forEach(function (warn) {
                    console.warn(warn.toString());
                });
                deferred.resolve(result.css);
            }).catch(function (error) {
                deferred.reject(error);
            });

            return deferred.promise();
        },

        /**
         * Минификация CSS
         */
        _minifyCss: function (data) {
            if (this._minify) {
                var deferred = vow.defer(),
                    processor = postcss(),
                    targetFile = this.node.resolvePath(path.basename(this._target)),
                    targetFolder = path.resolve(targetFile, '..');

                processor.use(easySprites({
                    imagePath: targetFolder,
                    spritePath: targetFolder
                }));

                processor.process(data, {
                    from: targetFile,
                    to: targetFile
                }).then(function (result) {

                    var cleanCssOptions = extend({}, this._cleancss);
                    var minStyles = new cleanCss(cleanCssOptions).minify(result.css).styles;

                    deferred.resolve(minStyles);
                }).catch(function (error) {
                    deferred.reject(error);
                });

                return deferred.promise();
            } else {
                return data;
            }

        },

        /**
         * Фильтр входных файлов
         * Необходим когда нужно сделать выбор между разными реализациями стилей
         *
         * Пример:
         * blocks/
         * ├── block.scss
         * └── block.css
         * Будет использован block.scss благодаря порядку файлов в useFileList
         */
        _filterSourceFiles: function (sourceFiles) {
            var added = {};

            return sourceFiles.filter(function (file) {
                var basename = file.fullname.substring(0, file.fullname.lastIndexOf('.'));

                if (added[basename]) {
                    return false;
                }

                added[basename] = true;

                return true;
            });
        },

        /**
         * Возвращает инструкции @import для SASS.
         */
        _sassGlobalsImports: function () {
            return this._globals.map(function (filename) {
                    var absolutePath = path.resolve(process.cwd(), filename);

                    absolutePath = absolutePath.replace(/\\/g, '/'); // Windows path fix

                    return '@import "' + absolutePath + '";';
                }).join('\n') + '\n';
        },

        //_sassDependencies: function (content, filename) {
        //    if (null === detectiveSass)
        //        detectiveSass = require('detective-sass');
        //
        //    // .scss или .sass
        //    // _???
        //    var dependencies = detectiveSass(content).map(function(relative) {
        //        return path.resolve(path.dirname(filename), relative);
        //    });
        //    console.log(dependencies);
        //},

        /**
         * Возвращает список объектов с информацией о глобально подключаемых SASS-файлах
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
                sass: this._sass,
                responsive: this._responsive,
                autoprefixer: this._autoprefixer,
                minify: this._minify,
                cleancss: this._cleancss
            }));
        }
    })
    .createTech();
