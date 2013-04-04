(function() {
    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
            "use strict";
            if (this == null) {
                throw new TypeError();
            }
            var t = Object(this);
            var len = t.length >>> 0;
            if (len === 0) {
                return -1;
            }
            var n = 0;
            if (arguments.length > 1) {
                n = Number(arguments[1]);
                if (n != n) { // shortcut for verifying if it's NaN
                    n = 0;
                } else if (n != 0 && n != Infinity && n != -Infinity) {
                    n = (n > 0 || -1) * Math.floor(Math.abs(n));
                }
            }
            if (n >= len) {
                return -1;
            }
            var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
            for (; k < len; k++) {
                if (k in t && t[k] === searchElement) {
                    return k;
                }
            }
            return -1;
        }
    }

})();

(function(Warlock) {
    Warlock.Global = {
        NULL_ID: -1,

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
        damageDict: function(modifiers) {
            var base = {
                melee: 0,
                range: 0,
                life: 0,
                death: 0,
                spirit: 0,
                elemental: 0
            };

            for( key in modifiers ) {
                base[key] = modifiers[key];
            }

            return base;
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
            this._id = config.gameId;
            this._nextId = config.nextId;
            this._listeners = [];

            this.attrs = {
                map: new Warlock.Map(config.map),
                players: [],
                units: [],
                currentPlayerId: config.currentPlayerId || 0,
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

        _newId: function() {
            return this._nextId++;
        },

        serialize: function() {
            var gameRef = this;

            var playersArray = [];
            this.getPlayers().forEach(function(player) {
                playersArray.push(player.serialize());
            });

            var unitsArray = [];
            this.getUnits().forEach(function(unit) {
                unitsArray.push(unit.serialize());
            });
            
            return {
                gameId: gameRef._id,
                nextId: gameRef._nextId,
                currentPlayerId: gameRef.attrs.currentPlayerId,
                map: gameRef.attrs.map.serialize(),
                players: playersArray,
                units: unitsArray
            }
        },

        addListener: function(listener) {
            if( this._listeners.indexOf(listener) == -1 ) {
                this._listeners.push(listener);
            }
        },

        addPlayer: function(playerConfig) {
            if( playerConfig !== undefined ) {
                var player = new Warlock.Player(playerConfig);

                if( player._id == Warlock.Global.NULL_ID ) {
                    player._id = this._newId();
                }
                this.attrs.players.push(player);
            }
        },

        addUnit: function(unitConfig) {
            if( unitConfig !== undefined ) {
                var unit = new Warlock.Unit(unitConfig);

                if( unit._id == Warlock.Global.NULL_ID ) {
                    unit._id = this._newId();
                }

                /* Unit's position. Requires hexes, which Unit cannot access. */
                var hex = this.getMap().hexes[unitConfig.pos.row][unitConfig.pos.col];
                this.attrs.units.push(unit);
                unit.hex = hex;
                hex.setUnit(unit);

                /* Unit's destination. Requires hexes, which Unit cannot access. */
                if( unitConfig.dest === undefined ) {
                    unit.dest = unit.hex;
                }
                else {
                    var dest = this.getMap().hexes[unitConfig.dest.row][unitConfig.dest.col];
                    unit.dest = dest;
                }
            }
        },

        advancePlayer: function() {
            this.attrs.currentPlayerId += 1;
            if( this.attrs.currentPlayerId >= players.length ) {
                this.attrs.currentPlayerId = 0;
            }
        },

        applyAttackResult: function(result) {
            var attacker = this.getUnit(result.attacker.id);
            var defender = this.getUnit(result.defender.id);

            attacker.current.hp -= result.attacker.hpLost;
            defender.current.hp -= result.defender.hpLost;

            attacker.current.move = 0;

            this.notify('attack-result', result);

            if( attacker.current.hp <= 0 ) {
                this.removeUnit(attacker);
                this.notify('unit-death', attacker);
            }
            if( defender.current.hp <= 0 ) {
                this.removeUnit(defender);
                this.notify('unit-death', defender);
            }
        },

        applyMoveResult: function(result) {
            var hexes = this.getMap().hexes;
            var unit = this.getUnit(result.unitId);
            unit.dest = hexes[result.dest.row][result.dest.col];
            unit.moveToHex(hexes[result.terminator.row][result.terminator.col]);
            unit.setMove(result.move);
            this.notify('unit-move', result);
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
            };

            return totalDamage;
        },

        endTurn: function() {
            console.log( 'TODO: implement endTurn' );
            // Warlock.units.forEach(function(unit) {
            //     if( unit.playerId == Warlock.currentPlayer ) {
            //         unit.setMove(unit.base.move);
            //     }
            // });

            // this.advancePlayer();
        },

        generatePath: function(unit, dest) {

            // Find the shortest path based on the cameFrom data.
            var reconstructPath = function(cameFrom, current) {
                // console.log( 'Reconstructing from: ' + current.getName() );

                if( current.getHashKey() in cameFrom ) {
                    var path = reconstructPath(cameFrom, cameFrom[current.getHashKey()]);
                    path.push(current);
                    return path;
                }
                else {
                    return [current];
                }
            };

            var openSet = [unit.hex]; // The set of nodes to explore.
            var cameFrom = {};        // Map of navigated nodes.

            var startHash = unit.hex.getHashKey();

            // Cost from start along best known path.
            var gScore = {};
            gScore[startHash] = 0;
            // Estimated total cost from start to goal through y.
            var fScore = {};
            fScore[startHash] = unit.hex.dist(dest);

            // Return the hex in openSet with the lowest fScore.
            var getNext = function() {
                var winner = openSet[0];
                var index = 0;
                var winnerF = fScore[winner.getHashKey()];

                for( var i = 1; i < openSet.length; i++ ) {
                    var f = fScore[openSet[i].getHashKey()];
                    if( f < winnerF ) {
                        winner = openSet[i];
                        index = i;
                        winnerF = f;
                    }
                }

                return winner;
            }
            
            var stepCount = 0;  // For testing purposes only.
            while( openSet.length > 0 && stepCount < 30 ) {
                stepCount += 1;

                var current = getNext();
                // console.log( "A-star step " + stepCount + ' ' + current.getName() );
                if( current == dest ) {
                    // console.log( "cameFrom" );
                    // for( key in cameFrom ) {
                    //     console.log( '  ' + key + ' <- ' + cameFrom[key].getName() );
                    // }
                    delete cameFrom[unit.hex.getHashKey()];
                    return reconstructPath(cameFrom, dest);
                }

                openSet.splice(openSet.indexOf(current), 1);
                this.getMap().getNeighbors(current).forEach(function(nb) {
                    tentativeGScore = gScore[current.getHashKey()] + unit.moveCost(current, nb);
                    // console.log( '  ' + nb.getName() + ' ' + tentativeGScore );
                    var isOpen = openSet.indexOf(nb) >= 0;
                    var nbKey = nb.getHashKey();

                    if( tentativeGScore >= gScore[nbKey] ) {}
                    else if( ! isOpen || tentativeGScore < gScore[nbKey] ) {
                        cameFrom[nbKey] = current;
                        gScore[nbKey] = tentativeGScore;
                        fScore[nbKey] = gScore[nbKey] + unit.moveCost(nb, dest);
                        if( !isOpen ) {
                            openSet.push(nb);
                        }
                    }
                });

                // console.log( 'open' );
                // openSet.forEach(function(hex) {
                //     var key = hex.getHashKey();
                //     console.log( '  ' + hex.getName() + ' g=' + gScore[key] + ' f=' + fScore[key] + ' from=' + cameFrom[key].getName() );
                // });
            }

            console.log( 'A* failed to find a path.' );
        },

        getCurrentPlayer: function() {
            return this.attrs.players[this.attrs.currentPlayerId];
        },

        /**
         * getMap()
         * @return Warlock.Map
         */

        /**
         * getPlayers()
         * @return Array of Warlock.Player
         */

        getId: function() {
            return this._id;
        },

        getUnit: function(id) {
            var units = this.getUnits();
            for( i in units ) {
                if( units[i].getId() == id ) {
                    return units[i];
                }
            }
            return null;
        },

        /**
         * getUnits()
         * @return Array of Warlock.Unit
         */

        /**
         * generateMoveResult(unit)
         * @param unit Warlock.Unit
         *
         * Create a serialized move result object that can be processed by applyMoveResult
         * and transmitted smoothly from the server to the client for application
         * client side.
         */
        generateMoveResult: function(unit) {
            var result = {
                unitId: unit.getId(),
                dest: unit.dest.getPos(),
                move: unit.getMove(),
                terminator: null,
                path: null,
                error: null
            };

            if( unit.playerId != this.getCurrentPlayerId() ) {
                result.error = "It is not this player's turn to move.";
                return result;
            }
            else {
                var path = this.generatePath(unit, unit.dest);

                if( path.length == 0 ) {
                    return { error: 'No path found to destination.' };
                }

                // The first hex in the path is the unit's current position.
                else if( path.length == 1 ) {
                    result.terminator = unit.hex.getPos();
                    result.path = [path[0].getPos()];
                    return result;
                }

                // Some actual movement can take place.
                else if( path.length > 1 ) {

                    // Figure out how many movement points were used up.
                    var i = 1;
                    var moveCost = unit.moveCost(path[i]);
                    while( i < path.length && moveCost <= result.move ) {
                        result.move -= moveCost;
                        i++;
                    }

                    // Push the actual path travelled into the result.
                    result.path = [];
                    path.splice(i);
                    path.forEach(function(hex) {
                        result.path.push(hex.getPos());
                    });

                    // Mark the final position of the unit.
                    result.terminator = result.path[result.path.length - 1];

                    return result;
                }
            }
        },

        /**
         * notify(eventName, data)
         * @param eventName String
         * @param data arbitrary value
         *
         * For each object that has been registered to listen to events from this game,
         * send it the event.
         */
        notify: function(eventName, data) {
            this._listeners.forEach(function(listener) {
                listener.receive(eventName, data);
            });
        },

        removeUnit: function(unit) {
            // Remove from array of all units.
            var index = this.units.indexOf(unit);
            console.assert( index >= 0 );
            this.units = this.units.splice(index, 1);
            
            // Remove from hex.
            unit.hex.unit = null;

            notify('unit-removed', unit);
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
            console.assert(this.getUnits().indexOf(unit) >= 0);

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
                        if( queue.indexOf(nbs[n]) == -1 ) {
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
    };

    Warlock.Global.addGetters(Warlock.Game, ['players', 'units', 'map', 'currentPlayerId']);

    /* Class for players. */
    Warlock.Player = function(config) {
        this._initPlayer(config);
    };

    Warlock.Player.prototype = {
        _initPlayer: function(config) {

            /* Required for object creation. */
            this._id = config.id || Warlock.Global.NULL_ID;
            this.color = config.color;

            /* Calculated from other values. */
            this.type = 'Player';
        },

        serialize: function() {
            var playerRef = this;
            return {
                id: playerRef._id,
                color: playerRef.color
            };
        },

        getId: function() {
            return this._id;
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

        serialize: function() {
            var mapref = this;

            var hexes = [];
            for( row in this.hexes ) {
                var hexRow = [];
                for( col in this.hexes[row] ) {
                    var hex = this.hexes[row][col];
                    hexRow.push(hex.serialize());
                }
                hexes.push(hexRow);
            }

            return {
                name: mapref.name,
                rows: mapref.rows,
                cols: mapref.cols,
                hexes: hexesArray,
            };
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

        getHex: function(pos) {
            return this.hexes[pos.row][pos.col];
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

        serialize: function() {
            var self = this;
            return {
                height: self.height,
                climate: self.climate,
                veg: self.veg
            };
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

        serialize: function() {
            var self = this;

            return {
                row: self.getRow(),
                col: self.getCol(),
                terrain: self.getTerrain().serialize()
            };
        },

        /**
         * dist(other)
         * @param other Warlock.Hex
         * @return Int
         *
         * Calculate the distance between this hex and the other hex.
         */
        dist: function(other) {
            var sign = function(x) { return x ? x < 0 ? -1 : 1 : 0; }

            var dx = other.attrs.row - this.attrs.row;
            var dy = other.attrs.diag - this.attrs.diag;

            
            if( sign(dx) == sign(dy) ) return Math.abs(dx + dy)
            else return Math.max(Math.abs(dx), Math.abs(dy))            
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
            return this.attrs.hashKey;
        },

        /**
         * getPos()
         * @return { row: this.getRow(), col: this.getCol() }
         */
        getPos: function() {
            var hexRef = this;
            return {
                row: hexRef.getRow(),
                col: hexRef.getCol()
            };
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
            }
        },

        serialize: function() {
            var self = this;

            return {
                name: self.getName(),
                kind: self.getKind(),
                range: self.getRange(),
                damageType: self.getDamageType(),
                powerMod: self.getPowerMod(),
            };
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
            this.actions = [];

            /* Required for object creation. */
            this.base = config.base;
            this.name = config.name;
            this.playerId = config.playerId;
            this.power = config.power;
            this.powerKind = config.powerKind;

            /* Optional values with defaults. */
            this._id = config.id || Warlock.Global.NULL_ID;
            this.hex = null;   // Warlock.Hex
            this.dest = null;  // Warlock.Hex
            this.type = 'Unit';
            this.powerMod = config.powerMod || 0;
            this.damageMod = Warlock.Global.damageDict(config.damageMod);
            this.resistance = Warlock.Global.damageDict(config.resistance);
            this.flying = config.flying || false;
            this.basicAttack = null;  // Warlock.Action

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
            if( config.current === undefined ) {
                this.current = {};
                for( key in config.base ) {
                    this.current[key] = config.base[key];
                }
            }
            else {
                this.current = config.current;
            }
        },

        serialize: function() {
            var self = this;

            var actionsArray = [];
            this.actions.forEach(function(action) {
                actionsArray.push(action.serialize());
            });
            // Don't include the basic attack in the serialization.
            if( self.basicAttack != null ) {
                actionsArray = actionsArray.slice(1);
            }

            return {
                id: self._id,
                name: self.name,
                playerId: self.playerId,
                power: self.power,
                powerKind: self.powerKind,
                powerMod: self.powerMod,
                base: self.base,
                current: self.current,
                pos: {
                    row: self.hex.row,
                    col: self.hex.col
                },
                actions: actionArray,
                resistance: self.resistance,
                damageMod: self.damageMod,
                flying: self.flying,
                dest: {
                    row: self.dest.row,
                    col: self.dest.col
                }
            };
        },

        getAction: function(name) {
            for( i in this.actions ) {
                if( this.actions[i].getName() == name ) {
                    return this.actions[i];
                }
            }
            return null;
        },

        getId: function() {
            return this._id;
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
            if( hex.getUnit() != null && hex.getUnit().playerId != this.playerId ) {
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
