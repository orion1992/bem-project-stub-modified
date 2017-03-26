/**
 * Техника создана на основе https://github.com/enb/enb-beautify
 * Изменения:
 *  - в js-beautify передаются опции, в противном случае не работают конструкции beautify preserve:star, beautify preserve:end
 *  - сами конструкции beautify preserve:star, beautify preserve:end в последствие удаляются из html
 *  - добавлен BootLint
 */

var vowFs = require('enb/lib/fs/async-fs'),
    beautifyHtml = null,
    bootLint = null;

module.exports = require('enb/lib/build-flow').create()
    .name('beautify-html')
    .target('target', '?.beauty.html')
    .defineOption('disableLintIds', []) // Список ID правил BootLint-ера которые не нужно обрабатывать
    .useSourceFilename('htmlFile', '?.html')
    .builder(function (htmlFileName) {

        if (null === beautifyHtml) {
            beautifyHtml = require('js-beautify').html;
        }

        if (null === bootLint) {
            bootLint = require('bootlint');
        }

        var disableLintIds = this._disableLintIds;

        return vowFs.read(htmlFileName, 'utf-8')
            .then(function (html) {
                var beauty = beautifyHtml(html, {})
                    .replace(/\s*\/\* beautify preserve:start \*\//g, '')
                    .replace(/\/\* beautify preserve:end \*\/\s*/g, '');

                bootLint.lintHtml(beauty, function (lint) {
                    console.warn(htmlFileName, lint.id, lint.message);
                }, disableLintIds);

                return beauty;
            });
    })
    .createTech();
