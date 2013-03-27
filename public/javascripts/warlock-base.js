(function(Warlock) {
    Warlock.Global = {
        _addGetter: function(constructor, attr) {
            var method = 'get' + attr.charAt(0).toUpperCase() + attr.slice(1);
            constructor.prototype[method] = function() {
                return this.attrs[attr];
            };
        },

        addGetters: function(constructor, arr) {
            var len = arr.length;
            for(var n = 0; n < len; n++) {
                var attr = arr[n];
                this._addGetter(constructor, attr);
            }
        },

        addSetters: function(constructor, arr) {
            var len = arr.length;
            for(var n = 0; n < len; n++) {
                var attr = arr[n];
                var method = 'set' + attr.charAt(0).toUpperCase() + attr.slice(1);
                constructor.prototype[method] = function(arg) {
                    if( arg !== undefined ) {
                        this.attrs[attr] = arg;
                    }
                    else {
                        throw 'tried to set attr to undefined: ' + attr;
                    }
                };
            }
        }
    };
    

    /* Terrain elevation */
    Warlock.elevation = {};
    Warlock.elevation.NO_HEIGHT = -1;
    Warlock.elevation.WATER     = 0;
    Warlock.elevation.PLAINS    = 1;
    Warlock.elevation.HILLS     = 2;
    Warlock.elevation.MOUNTAINS = 3;

    /* Terrain climate. */
    Warlock.climate = {};
    Warlock.climate.NO_CLIMATE = -1;
    Warlock.climate.FERTILE    = 0;
    Warlock.climate.BARREN     = 1;
    Warlock.climate.SNOWY      = 2;
    Warlock.climate.LAVA       = 3;

    /* Terrain Vegetation. */
    Warlock.vegetation = {};
    Warlock.vegetation.CLEAR  = 0;
    Warlock.vegetation.FOREST = 1;
    Warlock.vegetation.JUNGLE = 2;
    Warlock.vegetation.SWAMP  = 3;

    /* Class for terrain. */

    Warlock.Terrain = function(config) {
        this._initTerrain(config)
    };


    Warlock.Terrain.prototype = {
        _initTerrain: function(config) {
            
            /* Required for object creation. */
            this.height = config.height;
            this.climate = config.climate;
            this.veg = config.veg;

            /* Calculated from other values. */
            this.type = 'Terrain';
            this.color = this._setColor();
        },

        _setColor: function() {
            switch(this.height) {
            case Warlock.elevation.WATER:     return 'blue';
            case Warlock.elevation.PLAINS:    return '#7CFC00';
            case Warlock.elevation.HILLS:     return '#8B4513';
            case Warlock.elevation.MOUNTAINS: return '#aaa';
            }
        },
    };

    /* Class for hexes. */
    Warlock.Hex = function(config) {
        this._initHex(config);
    };

    Warlock.Hex.prototype = {
        _initHex: function(config) {
            this._neighbors = null; // Warlock.Map.neighbors caches results here.

            /* Required values in config. */
            this.required = ['row', 'col', 'terrain'];
            this.attrs = {
                type: 'Hex',

                /* Required for object creation. */
                row: config.row,
                col: config.col,
                terrain: new Warlock.Terrain(config.terrain),

                /* Additional values. */
                unit: null,
                diag: config.col + Math.floor( config.row / 2 ),
                hashKey: 'hex' + config.row + ',' + config.col,
            }

            Warlock.Global.addGetters(Warlock.Hex, ['row', 'col', 'unit', 'diag', 'hashKey', 'terrain']);
        },

        /**
         * getCol()
         * @return Int
         */

        /**
         * getDiag()
         * @return Int
         * The diagonal of a hex is defined by the formula col + floor(row / 2).
         * The diagonal can be used to efficiently calculate shortest distances between
         * two hexes (assuming they are on the same plane).
         */

        /**
         * getHashKey()
         * @return non-object value
         * Since objects cannot be used as hash keys, but hexes are often wanted as
         * the keys in a dictionary, they provide a hashkey that can be used for this
         * purpose. At this time, it is a unique string based on its row and col attrs,
         * but in the future it will more likely be its _id value. As such, it cannot
         * be counted on to be distinct from the hash key of other object types or of
         * primitives.
         */

        /**
         * getName()
         * @return String
         */
        getName: function() {
            return this.hashKey;
        },

        /**
         * getRow()
         * @return Int
         */

        /**
         * getUnit()
         * @return Warlock.Unit
         */

        /**
         * setUnit()
         * @param unit Warlock.Unit
         */
        setUnit: function(unit) {
            console.assert( unit == null || this.unit == null );
            this.unit = unit;
        },
    };


})(typeof exports === 'undefined' ? this['Warlock'] = {} : exports);
