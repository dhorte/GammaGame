(function(exports, undefined) {
    /* Terrain elevation */
    exports.elevation = {};
    exports.elevation.NO_HEIGHT = -1;
    exports.elevation.WATER     = 0;
    exports.elevation.PLAINS    = 1;
    exports.elevation.HILLS     = 2;
    exports.elevation.MOUNTAINS = 3;

    /* Terrain climate. */
    exports.climate = {};
    exports.climate.NO_CLIMATE = -1;
    exports.climate.FERTILE    = 0;
    exports.climate.BARREN     = 1;
    exports.climate.SNOWY      = 2;
    exports.climate.LAVA       = 3;

    /* Terrain Vegetation. */
    exports.vegetation = {};
    exports.vegetation.CLEAR  = 0;
    exports.vegetation.FOREST = 1;
    exports.vegetation.JUNGLE = 2;
    exports.vegetation.SWAMP  = 3;

})(typeof exports === 'undefined' ? this['Warlock'] = {} : exports);
