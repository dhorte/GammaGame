(function(Warlock) {
    Warlock.Global = {
        _addGetter: function(constructor, attr) {
            var method = 'get' + attr.charAt(0).toUpperCase() + attr.slice(1);
            if( constructor.prototype[method] === undefined ) {
                constructor.prototype[method] = function() {
                    return this.attrs[attr];
                };
            }
        },

        addGetters: function(constructor, arr) {
            var len = arr.length;
            for(var n = 0; n < len; n++) {
                var attr = arr[n];
                this._addGetter(constructor, attr);
            }
        },

        _addSetter: function(constructor, attr) {
            var method = 'set' + attr.charAt(0).toUpperCase() + attr.slice(1);
            constructor.prototype[method] = function(arg) {
                if( arg !== undefined ) {
                    this.attrs[attr] = arg;
                }
                else {
                    throw 'tried to set attr to undefined: ' + attr;
                }
            };
        },

        addSetters: function(constructor, arr) {
            var len = arr.length;
            for(var n = 0; n < len; n++) {
                var attr = arr[n];
                this._addSetter(constructor, attr);
            }
        },

        /* 
         * Create a new, empty damage dictionary.
         * Useful for calculating damage, storing damage modifiers, etc.
         */
        damageDict: function() {
            return {
                melee: 0,
                range: 0,
                life: 0,
                death: 0,
                spirit: 0,
                elemental: 0
            };
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


    Warlock.Game = function(config) {
        this._initGame(config);
    };

    Warlock.Game.prototype = {
        _initGame: function(config) {
            this.attrs = {
                map: new Warlock.Map(config.map),
                players: [],
                units: [],
                currentPlayerIndex: config.currentPlayerIndex || 0,
            };

            /* Load the players. */
            for( i in config.players ) {
                this.addPlayer(config.players[i]);
            }

            /* Load the units. */
            for( i in config.units ) {
                this.addUnit(config.units[i]);
            }
        },

        addPlayer: function(playerConfig) {
            if( playerConfig !== undefined ) {
                this.attrs.players.push(new Warlock.Player(playerConfig));
            }
        },

        addUnit: function(unitConfig) {
            if( unitConfig !== undefined ) {
                var hex = this.attrs.map.hexes[unitConfig.pos.row][unitConfig.pos.col];
                var unit = new Warlock.Unit(unitConfig);

                console.assert(hex !== undefined);
                console.assert(unit.hex == null);
                console.assert(hex.getUnit() == null);

                this.attrs.units.push(unit);
                unit.hex = hex;
                hex.setUnit(unit);
            }
        },

        advancePlayer: function() {
            this.attrs.currentPlayerIndex += 1;
            if( this.attrs.currentPlayerIndex >= players.length ) {
                this.attrs.currentPlayerIndex = 0;
            }
        },

        endTurn: function() {
            Warlock.units.forEach(function(unit) {
                if( unit.getPlayer() == Warlock.currentPlayer ) {
                    unit.setMove(unit.base.move);
                }
            });

            this.advancePlayer();
        },

        getCurrentPlayer: function() {
            return this.attrs.players[this.attrs.currentPlayerIndex];
        },

        /**
         * unitMovement(unit)
         * @param unit Warlock.Unit
         * @return {
         *     hexes: Array(Warlock.Hex) hexes that the unit can move to
         *     remain: Dict(Warlock.Hex -> Number) movement remaining after moving to hex
         * }
         */
        unitMovement: function(unit) {
            console.assert($.inArray(unit, this.getUnits()) >= 0);

            var done = [];
            var queue = [unit.hex];
            var remain = {};
            var todo = {};
            todo[unit.getMove()] = [unit.hex];  // Start with the current hex.
            var currentlyHandling = unit.getMove();

            var movable = [];

            /* 
             * Movement remaining is guaranteed to decrease at each step.
             * If we always work on the hexes that have the highest remaining movement,
             * then we will never repeat any hexes, and each hex will get the maximum
             * value of remaining movement the first time it is visited.
             */
            var nextRange = function() {
                console.assert( typeof currentlyHandling === "number" );

                var max = -1;
                for( key in todo ) {
                    var value = parseFloat(key);
                    if( value < currentlyHandling && value > max ) {
                        max = value;
                    }
                }

                currentlyHandling = max;
            };

            var addHex = function(hex, remaining) {
                if( todo[remaining] === undefined ) {
                    todo[remaining] = [];
                }
                todo[remaining].push(hex);
                queue.push(hex);
            };

            while( currentlyHandling >= 0 ) {
                for( i in todo[currentlyHandling] ) {
                    var hex = todo[currentlyHandling][i];
                    done.push(hex);
                    remain[hex.getHashKey()] = currentlyHandling;

                    // Find any neighbors that haven't been done, and get
                    // ready to do them.
                    var nbs = this.getMap().getNeighbors(hex);
                    for( n in nbs ) {
                        if( $.inArray(nbs[n], queue) == -1 ) {
                            var nbCost = unit.moveCost(nbs[n]);
                            if( nbCost <= currentlyHandling ) {
                                addHex(nbs[n], currentlyHandling - nbCost);
                            }
                        }
                    }
                }

                nextRange();
            };

            return {
                hexes: done,
                remain: remain
            };

        },

        /**
         * calcDamage(source, target, action, isAttacking)
         * @returns {
         *   total: total damage to apply
         *   types: Warlock.damageDict; damage by type
         *   global_defense: Dict( memo about each type of defense applied to all types )
         *   defense: Dict( memo about defense applied to each damage type )
         */
        calcDamage: function(source, target, action, isAttacking) {
            var power = source.power;

            /* Apply all power mods. */
            power += power * action.getPowerMod();
            power += power * source.powerMod;

            /* Calculate damage for all types. */
            var damage = Warlock.Global.damageDict();
            for( key in source.damageMod ) {
                damage[key] = power * source.damageMod[key];
            };

            /* Add in the base damage. */
            damage[action.getDamageType()] += power;

            /* Apply damage resistance. */
            for( key in damage ) {
                damage[key] -= (damage[key] * target.resistance[key]);
            };

            var totalDamage = 0;
            for( key in damage ) {
                totalDamage += damage[key];
                console.log( key + ' -> ' + damage[key] );
            };

            return totalDamage;
        },

        /**
         * getPlayers()
         * @return Array of Warlock.Player
         */

        /**
         * getUnits()
         * @return Array of Warlock.Unit
         */

        /**
         * getMap()
         * @return Warlock.Map
         */
    };

    Warlock.Global.addGetters(Warlock.Game, ['players', 'units', 'map']);

    /* Class for players. */
    Warlock.Player = function(config) {
        this._initPlayer(config);
    };

    Warlock.Player.prototype = {
        _initPlayer: function(config) {

            /* Required for object creation. */
            this.id = config.id;
            this.color = config.color;

            /* Calculated from other values. */
            this.type = 'Player';
        },
    };

    
    /* Class for maps. */
    Warlock.Map = function(config) {
        this._initMap(config);
    };

    Warlock.Map.prototype = {
        _initMap: function(config) {
            
            /* Required for object creation. */
            this.rows = config.rows;
            this.cols = config.cols;

            /* Optional. */
            this.name = config.name || "map";

            /* Values based on other values. */
            this.type = 'Map';

            /* The hexes that compose the map. */
            this.hexes = [];

            for( row in config.hexes ) {
                this.hexes.push([]);
                for( col in config.hexes[row] ) {
                    var hex = new Warlock.Hex(config.hexes[row][col])
                    this.hexes[row].push(hex);
                }
            }
        },

        calcNeighbors: function(hex) {
            /* Convenience declarations. */
            var row = hex.getRow();
            var col = hex.getCol();
            var hexes = this.hexes;

            /* Store of currently calculated neighbors. Will be returned. */
            var nbs = []

            if( col > 0 ) nbs.push( hexes[row][col - 1] );
            if( row % 2 == 0 ) {
                if( col < this.cols - 2 ) {
                    nbs.push( hexes[row][col + 1] );
                }
                if( row > 0 ) {
                    nbs.push( hexes[row - 1][col    ] );
                    nbs.push( hexes[row - 1][col + 1] );
                }
                if( row < this.rows - 1 ) {
                    nbs.push( hexes[row + 1][col    ] );
                    nbs.push( hexes[row + 1][col + 1] );
                }
            }
            else {
                if( col < this.cols - 1 ) {
                    nbs.push( hexes[row    ][col + 1] );
                    nbs.push( hexes[row - 1][col    ] );
                    nbs.push( hexes[row + 1][col    ] );
                }
                if( col > 0 ) {
                    nbs.push( hexes[row - 1][col - 1] );
                    nbs.push( hexes[row + 1][col - 1] );
                }
            }

            return nbs;
        },

        getNeighbors: function(hex) {
            if( hex._neighbors == null ) {
                hex._neighbors = this.calcNeighbors(hex);
            }
            return hex._neighbors;
        },
    };



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
            this.type = 'Hex';

            /* Required values in config. */
            this.required = ['row', 'col', 'terrain'];
            this.attrs = {

                /* Required for object creation. */
                row: config.row,
                col: config.col,
                terrain: new Warlock.Terrain(config.terrain),

                /* Additional values. */
                unit: null,
                diag: config.col + Math.floor( config.row / 2 ),
                hashKey: 'hex' + config.row + ',' + config.col,
            }

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
            this.attrs.unit = unit;
        },
    };
    
    Warlock.Global.addGetters(Warlock.Hex, ['row', 'col', 'unit', 'diag', 'hashKey', 'terrain']);


    /*
     * Actions
     * Actions are intended to be immutable after their creation. Any mods to them should
     * be applied to the unit who has the action.
     */
    Warlock.Action = function(config) {
        this._initAction(config);
    };

    Warlock.Action.prototype = {
        _initAction: function(config) {
            this.attrs = {
                /* Required for object creation. */
                name: config.name,      // arbitrary identifier
                kind: config.kind,      // 'attack' or 'heal'
                range: config.range,    // 0 = self, 1 = adjacent, etc.
                damageType: config.damageType,
                
                /* Optional. */
                powerMod: config.powerMod || 0.0,
                effects: config.effects || [],
            }
        },
    };
    
    Warlock.Global.addGetters(Warlock.Action, ['name', 'kind', 'range', 'damageType', 'powerMod', 'effects']);


    Warlock.Unit = function(config) {
        this._initUnit(config);
    };

    Warlock.Unit.prototype = {
        _initUnit: function(config) {
            var unitRef = this;

            /* Dictionaries that we'll need to fill. */
            this.base = {};
            this.actions = [];

            /* Required for object creation. */
            this.name = config.name;
            this.player_id = config.player_id;
            this.power = config.power;
            this.powerKind = config.powerKind;
            this.base.hp = config.hp;
            this.base.move = config.move;

            /* Optional values with defaults. */
            this.hex = null;
            this.type = 'Unit';
            this.powerMod = config.powerMod || 0;
            this.damageMod = $.extend(Warlock.Global.damageDict(), config.damageMod);
            this.resistance = $.extend(Warlock.Global.damageDict(), config.resistance);
            this.flying = config.flying || false;
            this.basicAttack = null;

            /* Create a basic attack for this unit, based on its power. */
            if( config.power > 0 && !config.noAttack ) {
                this.basicAttack = new Warlock.Action({
                    name: 'basic attack',
                    kind: 'attack',
                    range: (function() {
                        if( config.powerKind == 'melee' ) return 1;
                        else return 2;
                    })(),
                    damageType: unitRef.powerKind,
                });
                this.actions.push(this.basicAttack);
            }

            /* Add additional actions from the config file. */
            if( config.actions !== undefined ) {
                config.actions.forEach(function(actionConfig) {
                    unitRef.actions.push(new Warlock.Action(actionConfig));
                });
            }

            /* Copy the base values into current, which is where they will be updated. */
            this.current = $.extend({}, this.base);
        },

        getPlayer: function() {
            return Warlock.game.getPlayers()[this.player_id];
        },

        getMove: function() {
            return this.current.move;
        },

        setMove: function(amount) {
            console.assert(amount >= 0);
            console.assert(amount <= this.base.move);
            this.current.move = amount;

            /* Create a visual indicator when a unit has no more movement points. */
            if( this.current.move == 0 ) {
                console.log( "TODO: Show a visual indicator when movement is exhausted." )
            }
        },

        moveCost: function(hex) {
            if( hex.getUnit() != null && hex.getUnit().getPlayer() != this.getPlayer() ) {
                return Number.MAX_VALUE;
            }
            else if( this.flying ) {
                return 1;
            }
            else if( this.marine ) {
                if( hex.terrain.height == Warlock.WATER ) return 1;
                else return Number.MAX_VALUE;
            }
            else {
                var terrain = hex.getTerrain();
                /* Impassable terrain. */
                if( terrain.height == Warlock.elevation.MOUNTAINS ||
                    terrain.height == Warlock.elevation.WATER ) return Number.MAX_VALUE;

                /* Vegetation. */
                else if( terrain.veg == Warlock.vegetation.FOREST ) return 2;
                else if( terrain.veg == Warlock.vegetation.JUNGLE ) return 2;
                else if( terrain.veg == Warlock.vegetation.SWAMP ) return 4;

                /* Raw terrain. */
                else if( terrain.height == Warlock.elevation.PLAINS ) return 1;
                else if( terrain.height == Warlock.elevation.HILLS ) return 2;
                else throw "unknown terrain";
            }
        },

        /**
         * Move this unit to the specified hex.
         * This function tests if the unit can legally be positioned on that hex, which
         * could be prevented by terrain conditions, enemy units, etc. However, it does
         * not check or update movement points. So, this can be used by various effects
         * to move the unit without worrying about affecting the movement points of the
         * unit.
         * @param hex Location of this unit after calling the function.
         */
        moveToHex: function(hex) {
            this.hex.setUnit(null);
            this.hex = hex;
            hex.setUnit(this);
        },
    };

})(typeof exports === 'undefined' ? this['Warlock'] = {} : exports);
