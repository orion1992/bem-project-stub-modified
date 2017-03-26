/**
 * @module jquery
 * @description Provide jQuery (load if it does not exist).
 */

modules.define(
    'jquery',
    ['loader_type_js', 'jquery__config'],
    function(provide, loader, cfg) {

/* global jQuery */

function doProvide(preserveGlobal) {
    /**
     * @exports
     * @type Function
     */
    // console.log(preserveGlobal);
    provide(preserveGlobal ? jQuery : jQuery.noConflict(true));
    // provide(preserveGlobal ? jQuery.noConflict(true) : jQuery);
    // provide(jQuery);

}

typeof jQuery !== 'undefined'?
    doProvide(true) :
    loader(cfg.url, doProvide);
});
