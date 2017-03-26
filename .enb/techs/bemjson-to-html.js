/**
 * Техника создана на основе https://github.com/enb/enb-bh
 * Изменения:
 *  - workaround для бага связанного с кешированием require в bemjson
 */

var inherit = require('inherit'),
    bemjsonToHtml = require('enb-bh/techs/bemjson-to-html');

module.exports = inherit(bemjsonToHtml, {
    render: function (BH, bemjson) {
        /**
         * Передаем на обработку клон прочитанного bemjson. Это хак, чтобы обойти кеширование require внутри bemjson.
         * В противном случае к закешированному require внунтри bemjson шаблоны BH будут применены только 1 раз,
         * а при изменении в шаблонизатор будет передаваться результат с уже примененными шаблонами.
         */
        bemjson = JSON.parse(JSON.stringify(bemjson));

        return this.__base(BH, bemjson);
    }
});
