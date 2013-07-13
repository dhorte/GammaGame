(function() {

    if (typeof require == 'function') { 
        this['Log'] = require('./logger.js');
    }

    Log.set( 'visibility:debug' );


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
    "use strict";

    var ser_log = Log.get("serializer");
    var gen_log = Log.get("general");

    Warlock.util = {};

    /**
     * @param hex the center of the disc
     * @param radius number of hexes away to collect (0 = only the center)
     * @returns an array of hexes in the disc
     */
    Warlock.util.hexDisc = function(map, hex, radius) {
        var disc = [];
        var done = [hex];
        var steps = { 0: [hex] };
        
        for( var i = 0; i <= radius; i ++ ) {
            steps[i + 1] = [];
            steps[i].forEach(function(curr) {
                disc.push(curr);
                map.getNeighbors(curr).forEach(function(nb) {
                    if( done.indexOf(nb) == -1 ) {
                        steps[i + 1].push(nb);
                        done.push(nb);
                    }
                });
            });
        }

        return disc;
    };

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

            for( var key in modifiers ) {
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

    /* Terrain special. */
    Warlock.UNEXPLORED = 'unexplored';


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
                players: {},
                units: [],
                currentPlayerId: config.currentPlayerId || 1,
            };

            /* Load the players. */
            for( var i in config.players ) {
                this.addPlayer(config.players[i]);
            }

            /* Load the units. */
            for( var i in config.units ) {
                this.addUnit(config.units[i]);
            }
        },

        _newId: function() {
            return this._nextId++;
        },

        /**
         * serialize(playerId)
         * @param playerId Int: Player whose point of view to use.
         * @return Dict: config file for instantiating a new Warlock.Game
         *
         * If @param playerId is unspecified, then serialize the whole game.
         * Otherwise, serialize only those parts of the game that the specified player
         * has knowledge about.
         */
        serialize: function(playerId) {
            ser_log.coarse('Serializing Warlock.Game for player ' + playerId);
            var gameRef = this;
            var player = this.getPlayer(playerId);

            if( typeof player === 'undefined' ) {
                console.assert( false, 'Player is not defined.' );
            }

            var playersDict = {};
            var players = this.getPlayers();
            for( var key in players ) {
                playersDict[key] = players[key].serialize(player);
            }

            // Don't send information about units that the target player cannot see.
            var unitsArray = [];
            this.getUnits().forEach(function(unit) {
                ser_log.fine( "  Considering " + unit.getName() + ' at ' + unit.getHex().getName() );
                if( typeof player !== 'undefined' && player.isVisible(unit.getHex()) ) {
                    unitsArray.push(unit.serialize(player));
                }
            });
            
            return {
                gameId: gameRef._id,
                nextId: gameRef._nextId,
                currentPlayerId: gameRef.attrs.currentPlayerId,
                map: gameRef.getMap().serialize(player),
                players: playersDict,
                units: unitsArray,
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
                this.attrs.players[player.getId()] = player;
            }
        },

        addUnit: function(unitConfig) {
            if( unitConfig !== undefined ) {
                var unit = new Warlock.Unit(unitConfig);

                if( unit._id == Warlock.Global.NULL_ID ) {
                    unit._id = this._newId();
                }

                /* Unit's position. Requires hexes, which Unit cannot access. */
                var map = this.getMap()
                var hex = map.getHexes()[unitConfig.pos.row][unitConfig.pos.col];
                this.attrs.units.push(unit);
                unit.setHex(hex);
                hex.setUnit(unit);

                /* Update the player visibility for this unit. */
                this.updateVisibility(hex, unit);

                /* Unit's destination. Requires hexes, which Unit cannot access. */
                if( typeof unitConfig.dest === 'undefined' ) {
                    unit.setDest(hex);
                }
                else {
                    var dest = map.getHexes()[unitConfig.dest.row][unitConfig.dest.col];
                    unit.setDest(dest);
                }
            }
        },

        applyAttackResult: function(result) {
            var attacker = this.getUnit(result.attacker.id);
            var defender = this.getUnit(result.defender.id);

            attacker.reduceHp( result.attacker.hpLost );
            defender.reduceHp( result.defender.hpLost );

            attacker.setMove(0);

            this.notify('attack-result', result);

            if( attacker.getHp() <= 0 ) {
                this.removeUnit(attacker);
                this.notify('unit-death', attacker);
            }
            if( defender.getHp() <= 0 ) {
                this.removeUnit(defender);
                this.notify('unit-death', defender);
            }
        },

        applyEndTurnResult: function(result) {
            this.attrs.currentPlayerId = result.currentPlayerId;
        },

        applyMoveResult: function(result) {
            var self = this;

            // Apply the new status to the game.
            var map = this.getMap();
            var unit = this.getUnit(result.unitId);
            unit.setHex(map.getHex(result.terminator));
            unit.setDest(map.getHex(result.dest));
            unit.setMove(result.move);

            // Reveal newly explored hexes.
            var player = this.getPlayer(unit.getPlayerId());
            result.explored.forEach(function(hexData) {
                var hex = map.getHex(hexData);
                hex.update(hexData);
                self.notify('hex-explored', hex);
            });

            // Update visible hexes.
            result.seen.forEach(function(pos) {
                player.setVisible(map.getHex(pos));
            });

            this.notify('unit-move', result);
        },

        /**
         * calcDamage(source, target, action, isAttacking)
         * NOTE FROM ORIGINAL: Damage Taken = Floor( 2^(-Damage Resistance/50) - 1 )
         * @returns {
         *   total: total damage to apply
         *   types: Warlock.damageDict; damage by type
         *   global_defense: Dict( memo about each type of defense applied to all types )
         *   defense: Dict( memo about defense applied to each damage type )
         * }
         */
        calcDamage: function(source, target, action, isAttacking) {
            var power = source.getPower();

            /* Apply all power mods. */
            power += power * action.getPowerMod();
            power += power * source.getPowerMod();

            /* Calculate damage for all types. */
            var damage = Warlock.Global.damageDict();
            var damageMod = source.getDamageMod();
            for( var key in source.getDamageMod() ) {
                damage[key] = power * damageMod[key];
            };

            /* Add in the base damage. */
            damage[action.getDamageType()] += power;

            /* Apply damage resistance. */
            var targetResist = target.getResistance();
            for( var key in damage ) {
                damage[key] -= (damage[key] * targetResist[key]);
            };

            var totalDamage = 0;
            for( var key in damage ) {
                totalDamage += damage[key];
            };

            return totalDamage;
        },

        generatePath: function(unit, dest) {
            var log = Log.get('astar');
            log.coarse( 'Generating path from ' + unit.getHex().getName() + ' to ' + dest.getName() );

            // Find the shortest path based on the cameFrom data.
            var reconstructPath = function(cameFrom, current) {
                log.fine( 'Reconstructing from: ' + current.getName() );

                if( current.getHashKey() in cameFrom ) {
                    var path = reconstructPath(cameFrom, cameFrom[current.getHashKey()]);
                    path.push(current);
                    return path;
                }
                else {
                    return [current];
                }
            };

            var openSet = [unit.getHex()]; // The set of nodes to explore.
            var cameFrom = {};        // Map of navigated nodes.

            var startHash = unit.getHex().getHashKey();

            // Cost from start along best known path.
            var gScore = {};
            gScore[startHash] = 0;
            // Estimated total cost from start to goal through y.
            var fScore = {};
            fScore[startHash] = unit.getHex().dist(dest);

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
                log.fine( 'current: ' + current.getName() );
                if( current == dest ) {
                    // Remove the original point from the cameFrom dict, as that breaks
                    // the reconstructPath function.
                    delete cameFrom[unit.getHex().getHashKey()];
                    return reconstructPath(cameFrom, dest);
                }

                openSet.splice(openSet.indexOf(current), 1);
                this.getMap().getNeighbors(current).forEach(function(nb) {
                    var tentativeGScore = gScore[current.getHashKey()] + unit.moveCost(current, nb);
                    log.fine( '  ' + nb.getName() + ' ' + tentativeGScore );
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

            }

            log.coarse( 'A* failed to find a path.' );
        },

        getCurrentPlayer: function() {
            return this.getPlayer(this.attrs.currentPlayerId);
        },

        /**
         * getMap()
         * @return Warlock.Map
         */

        getPlayer: function(playerId) {
            return this.attrs.players[playerId];
        },

        /**
         * getPlayers()
         * @return Dict of Int -> Warlock.Player
         */

        getId: function() {
            return this._id;
        },

        getUnit: function(id) {
            var units = this.getUnits();
            for( var i in units ) {
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
                dest: unit.getDest().getPos(),
                move: unit.getMove(),
                terminator: null,   // Where the unit is after the movement.
                path: null,         // Array of positions crossed while moving.
                seen: null,         // List of hexes made visible by unit movement.
                explored: null,     // List of hexes explored by unit movement.
                error: null
            };

            if( unit.getPlayerId() != this.getCurrentPlayerId() ) {
                result.error = "It is not this player's turn to move.";
                return result;
            }
            else {
                var path = this.generatePath(unit, unit.getDest());

                if( path.length == 0 ) {
                    return { error: 'No path found to destination.' };
                }

                // The first hex in the path is the unit's current position.
                else if( path.length == 1 ) {
                    result.terminator = unit.getHex().getPos();
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
                    // At the same time, list up revealed hexes.
                    result.path = [];
                    var revealed = [];
                    var player = this.getPlayer(unit.getPlayerId());
                    var map = this.getMap();
                    path.splice(i);
                    path.forEach(function(hex) {
                        result.path.push(hex.getPos());
                        Warlock.util.hexDisc(map, hex, unit.getSight()).forEach(function(seen_hex) {
                            if( ! player.isVisible(seen_hex) && revealed.indexOf(hex) < 0 ) {
                                revealed.push(seen_hex);
                            }
                        });
                    });

                    // Push the revealed and explored hexes into the result.
                    result.seen = [];
                    result.explored = [];
                    revealed.forEach(function(hex) {
                        result.seen.push(hex.getPos());
                        if( !player.isExplored(hex) ) {
                            result.explored.push( hex.serialize() );
                        };
                    });

                    // Mark the final position of the unit.
                    result.terminator = result.path[result.path.length - 1];

                    return result;
                }
            }
        },

        nextPlayer: function() {
            var currentId = this.getCurrentPlayerId();
            var minId = currentId;
            var nextId = 123456;

            for( var key in this.getPlayers() ) {
                if( key < minId ) {
                    minId = key;
                }
                if( key > currentId && key < nextId ) {
                    nextId = key;
                }
            }

            if( nextId < 123456 ) return nextId;
            else return minId;
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
            unit.getHex.unit = null;

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
            var queue = [unit.getHex()];
            var remain = {};
            var todo = {};
            todo[unit.getMove()] = [unit.getHex()];  // Start with the current hex.
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
                for( var key in todo ) {
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
                for( var i in todo[currentlyHandling] ) {
                    var hex = todo[currentlyHandling][i];
                    done.push(hex);
                    remain[hex.getHashKey()] = currentlyHandling;

                    // Find any neighbors that haven't been done, and get
                    // ready to do them.
                    var nbs = this.getMap().getNeighbors(hex);
                    for( var n in nbs ) {
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

        updateVisibility: function(hex, unit) {
            var player = this.getPlayer(unit.getPlayerId());
            var map = this.getMap();
            Warlock.util.hexDisc(map, hex, unit.getSight()).forEach(function(hex) {
                player.setVisible(hex);
            });
        },
    };

    Warlock.Global.addGetters(Warlock.Game, ['players', 'units', 'map', 'currentPlayerId']);

    /* Class for players. */
    Warlock.Player = function(config) {
        this._initPlayer(config);
    };

    Warlock.Player.prototype = {
        _initPlayer: function(config) {
            this._id = config.id || Warlock.Global.NULL_ID;
            this.type = 'Player';

            this.attrs = {
                color: config.color,

                // List of names of hexes that are visible to this player.
                visibleHexes: config.visibleHexes || [],
                exploredHexes: config.exploredHexes || [],
            };
        },

        /**
         * Serialize this player from the point of view of @param player.
         * If player is not specified, serialize completely.
         */
        serialize: function(player) {
            var playerRef = this;

            if( typeof player === 'undefined' ) {
                ser_log.coarse('Serializing Warlock.Player, id = ' + this.getId());
                return {
                    id: playerRef.getId(),
                    color: playerRef.getColor(),
                    exploredHexes: this.getExploredHexes()
                };
            }
            else {
                ser_log.coarse('Serializing Warlock.Player, id = ' + this.getId() + ' for player ' + player.getId());
                return {
                    id: playerRef.getId(),
                    color: playerRef.getColor()
                }
            }
        },

        /**
         * Add a new visible hex.
         */
        addVisible: function(hex) {
            var hexName = hex.getName();

            this.attrs.visibleHexes.push(hexName);

            // This first time a hex is seen, add it to the list of explored hexes.
            if( exploredHexes.indexOf(hexName) < 0 ) {
                exploredHexes.push(hexName);
            }
        },

        getId: function() {
            return this._id;
        },

        isExplored: function(hex) {
            return this.getExploredHexes().indexOf(hex) > -1;
        },

        /**
         * Test if a particular hex is visible to this player.
         */
        isVisible: function(hex) {
            return this.attrs.visibleHexes.indexOf(hex) >= 0;
        },

        /**
         * Add a new hex to the list of visible hexes for this player.
         */
        setVisible: function(hex) {
            if( !this.isVisible( hex ) ) {
                this.attrs.visibleHexes.push(hex);
            }
            if( !this.isExplored( hex ) ) {
                this.attrs.exploredHexes.push(hex);
            }
        },

        /**
         * Replace the existing set of visible hexes with a new one.
         */
        replaceVisible: function(hexes) {
            var self = this;
            this.attrs.visibleHexes = [];
            hexes.forEach(function(hex) {
                self.attrs.visibleHexes.push(hex);
            });
        },
    };
    Warlock.Global.addGetters(Warlock.Player, ['color', 'exploredHexes', 'visibleHexes']);

    
    /* Class for maps. */
    Warlock.Map = function(config) {
        this._initMap(config);
    };

    Warlock.Map.prototype = {
        _initMap: function(config) {
            this.type = 'Map';

            this.attrs = {
                rows: config.rows,
                cols: config.cols,
                name: config.name || 'map',
                hexes: [],
            };

            for( var row in config.hexes ) {
                this.attrs.hexes.push([]);
                for( var col in config.hexes[row] ) {
                    var hex = new Warlock.Hex(config.hexes[row][col])
                    this.attrs.hexes[row].push(hex);
                }
            }
        },

        serialize: function(player) {
            if( typeof player === 'undefined' ) {
                ser_log.coarse('Serializing Warlock.Map');
            }
            else {
                ser_log.coarse('Serializing Warlock.Map for player' + player.getId());
            }
            var mapref = this;

            ser_log.medium('Serializing hexes.');
            var realHexes = this.getHexes();
            var serHexes = [];
            for( var row in realHexes ) {
                var hexRow = [];
                for( var col in realHexes[row] ) {
                    var hex = realHexes[row][col];
                    hexRow.push(hex.serialize(player));
                }
                serHexes.push(hexRow);
            }

            return {
                name: mapref.getName(),
                rows: mapref.getRows(),
                cols: mapref.getCols(),
                hexes: serHexes,
            };
        },

        calcNeighbors: function(hex) {
            /* Convenience declarations. */
            var row = hex.getRow();
            var col = hex.getCol();
            var hexes = this.getHexes();

            /* Store of currently calculated neighbors. Will be returned. */
            var nbs = []

            if( col > 0 ) nbs.push( hexes[row][col - 1] );
            if( row % 2 == 0 ) {
                if( col < this.getCols() - 2 ) {
                    nbs.push( hexes[row][col + 1] );
                }
                if( row > 0 ) {
                    nbs.push( hexes[row - 1][col    ] );
                    nbs.push( hexes[row - 1][col + 1] );
                }
                if( row < this.getRows() - 1 ) {
                    nbs.push( hexes[row + 1][col    ] );
                    nbs.push( hexes[row + 1][col + 1] );
                }
            }
            else {
                if( col < this.getCols() - 1 ) {
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
            return this.getHexes()[pos.row][pos.col];
        },

        getNeighbors: function(hex) {
            if( hex._neighbors == null ) {
                hex._neighbors = this.calcNeighbors(hex);
            }
            return hex._neighbors;
        },
    };

    Warlock.Global.addGetters(Warlock.Map, ['rows', 'cols', 'name', 'hexes']);



    /* Class for terrain. */
    Warlock.Terrain = function(config) {
        this._initTerrain(config)
    };


    Warlock.Terrain.prototype = {
        _checkConfig: function(config) {
            console.assert( config !== undefined );
        },
            

        _initTerrain: function(config) {
            this._checkConfig(config);

            this.type = 'Terrain';
            
            this.attrs = {
                explored: (config != Warlock.UNEXPLORED),
                height: config.height,
                climate: config.climate,
                veg: config.veg,
            };
        },

        serialize: function() {
            var self = this;
            return {
                height: self.getHeight(),
                climate: self.getClimate(),
                veg: self.getVeg(),
            };
        },
    };

    Warlock.Global.addGetters(Warlock.Terrain, ['height', 'climate', 'veg', 'explored']);




    /* Class for hexes. */
    Warlock.Hex = function(config) {
        this._initHex(config);
    };

    Warlock.Hex.prototype = {
        required: ['row', 'col', 'terrain'],
        checkConfig: function(config) {
            // Must have a valid config file.
            console.assert(config !== undefined);

            // Must have all required fields.
            this.required.forEach(function(string) {
                if( config[string] === undefined ) {
                    console.log( '==================================================' );
                    console.log( config );
                    throw 'Required value missing in config: ' + string;
                }
            });
        },        

        _initHex: function(config) {
            this.checkConfig(config);

            this._neighbors = null; // Warlock.Map.neighbors caches results here.
            this.type = 'Hex';

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

        serialize: function(player) {
            if( typeof player === 'undefined' ) {
                ser_log.fine('Serializing ' + this.getName());
            }
            else {
                ser_log.fine('Serializing ' + this.getName() + ' for ' + player.getId());
            }

            var self = this;

            // If the hex has been explored, the terrain is still visible even if the
            // player no longer has visibility to the hex.
            var terrainSer = Warlock.UNEXPLORED;
            if( typeof player === 'undefined' ) {
                terrainSer = this.getTerrain().serialize();
            }
            else if( typeof player !== 'undefined' && player.isExplored(this) ) {
                terrainSer = this.getTerrain().serialize();
            }

            return {
                row: self.getRow(),
                col: self.getCol(),
                terrain: terrainSer,
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
         * getTerrain()
         * @return Warlock.Terrain
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

        /**
         * update(config)
         * @param data serialization of hex data
         * This function basically assumes that this hex was previous unexplored and
         * that the data that describes the hex has just been received.
         */
        update: function(config) {
            gen_log.coarse( "Updating hex information." );
            this.attrs.terrain = new Warlock.Terrain(config.terrain);
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


    Warlock.City = function(config) {
        this._initCity(config);
    };

    Warlock.City.prototype = {
        _initCity: function(config) {
            this.attrs = {
                name: config.name,
                playerId: config.playerId,

                population: config.population || 1000,
                buildings: config.buildings || [],

                hex: null
            };
        },

        getGrowth: function() {
            return 100;
        },

        getSize: function() {
            return Math.floor(this.getPopulation() / 1000);
        },

    };

    Warlock.Global.addGetters(Warlock.City, ['buildings', 'hex', 'name', 'playerId', 'population']);

    Warlock.Unit = function(config) {
        this._initUnit(config);
    };

    Warlock.Unit.prototype = {
        _initUnit: function(config) {
            var unitRef = this;

            this._id = config.id || Warlock.Global.NULL_ID;
            this.type = 'Unit';

            this.attrs = {
                name: config.name,
                playerId: config.playerId,

                actions: [],
                move: -1,  // initialized later
                hp: -1,    // initialized later
                sight: config.sight,

                /* Combat related values. */
                power: config.power,
                powerKind: config.powerKind,
                powerMod: config.powerMod || 0,
                damageMod: Warlock.Global.damageDict(config.damageMod),
                resistance: Warlock.Global.damageDict(config.resistance),
                basicAttack: null,

                /* Flags. */
                flying: config.flying || false,
                marine: config.marine || false,

                base: config.base,  // base values for hp, movement, etc.
                
                hex: null,
                dest: null,
            };

            /* Create a basic attack for this unit, based on its power. */
            if( config.power > 0 && !config.noAttack ) {
                this.attrs.basicAttack = new Warlock.Action({
                    name: 'basic attack',
                    kind: 'attack',
                    range: (function() {
                        if( config.powerKind == 'melee' ) return 1;
                        else return 2;
                    })(),
                    damageType: unitRef.getPowerKind(),
                });
                this.addAction(this.attrs.basicAttack);
            }

            /* Add additional actions from the config file. */
            if( config.actions !== undefined ) {
                config.actions.forEach(function(actionConfig) {
                    unitRef.addAction(new Warlock.Action(actionConfig));
                });
            }

            /* Copy the base values into current, which is where they will be updated. */
            if( config.current === undefined ) {
                this.current = {};
                for( var key in config.base ) {
                    this.attrs[key] = config.base[key];
                }
            }
            else {
                for( var key in config.current ) {
                    this.attrs[key] = config.current[key];
                }
            }
        },

        addAction: function(action) {
            this.attrs.actions.push(action);
        },

        serialize: function(player) {
            if( player === 'undefined' ) {
                ser_log.medium( 'Serializing Warlock.Unit' );
            }
            else {
                ser_log.medium( 'Serializing Warlock.Unit for ' + player.getId());
            }

            var self = this;

            var actionsArray = [];
            this.getActions().forEach(function(action) {
                actionsArray.push(action.serialize());
            });
            // Don't include the basic attack in the serialization.
            if( self.getBasicAttack() != null ) {
                actionsArray = actionsArray.slice(1);
            }

            var dict = {
                id: self._id,
                name: self.getName(),
                playerId: self.getPlayerId(),
                power: self.getPower(),
                powerKind: self.getPowerKind(),
                powerMod: self.getPowerMod(),
                base: self.getBase(),
                hp: self.getHp(),
                move: self.getMove(),
                pos: self.getHex().getPos(),
                actions: actionsArray,
                resistance: self.getResistance(),
                damageMod: self.getDamageMod(),
                flying: self.getFlying(),
                marine: self.getMarine(),
                dest: self.getDest().getPos(),
            };

            return dict;
        },

        getAction: function(name) {
            var actions = this.getActions();
            for( var i in actions ) {
                if( actions[i].getName() == name ) {
                    return actions[i];
                }
            }
            throw 'Unknown action: ' + name;
        },

        getCol: function() {
            return this.getHex().getCol();
        },

        getId: function() {
            return this._id;
        },

        getRow: function() {
            return this.getHex().getCol();
        },

        setMove: function(amount) {
            if( amount < 0 ) this.attrs.move = 0;
            else if( amount > this.getBase().move ) this.attrs.move = this.getBase().move;
            else this.attrs.move = amount;
        },

        moveCost: function(hex) {

            // Can't move onto or through enemy units.
            if( hex.getUnit() != null && hex.getUnit().getPlayerId() != this.getPlayerId() ) {
                return Number.MAX_VALUE;
            }

            // Flying units always have move cost one.
            else if( this.getFlying() ) {
                return 1;
            }

            // Marine units can only move on water.
            // Marine units always have move cost 1 one water.
            else if( this.getMarine() ) {
                if( hex.getTerrain().getHeight() == Warlock.WATER ) return 1;
                else return Number.MAX_VALUE;
            }

            // For ground units, movement is based on the terrain type.
            else {
                var terrain = hex.getTerrain();
                var height = terrain.getHeight();
                var veg = terrain.getVeg();

                // Impassable terrain.
                if( height == Warlock.elevation.MOUNTAINS ||
                    height == Warlock.elevation.WATER ) return Number.MAX_VALUE;

                // Vegetation.
                else if( veg == Warlock.vegetation.FOREST ) return 2;
                else if( veg == Warlock.vegetation.JUNGLE ) return 2;
                else if( veg == Warlock.vegetation.SWAMP ) return 4;

                // Raw terrain.
                else if( height == Warlock.elevation.PLAINS ) return 1;
                else if( height == Warlock.elevation.HILLS ) return 2;

                // Unexplored.
                else if( !terrain.getExplored() ) return Number.MAX_VALUE;

                else throw "unknown terrain";
            }
        },

        reduceHp: function(amount) {
            this.attrs.hp -= amount;
            if( this.attrs.hp < 0 ) this.attrs.hp = 0;
        },

        setHex: function(hex) {
            if( this.getHex() != null ) {
                this.attrs.hex.setUnit(null);
            }
            this.attrs.hex = hex;
            hex.setUnit(this);
        },

    };

    Warlock.Global.addGetters(Warlock.Unit, ['name', 'playerId', 'actions', 'move', 'hp', 'power', 'powerKind', 'powerMod', 'damageMod', 'resistance', 'basicAttack', 'flying', 'hex', 'dest', 'base', 'marine', 'sight']);

    Warlock.Global.addSetters(Warlock.Unit, ['dest']);

})(typeof exports === 'undefined' ? this['Warlock'] = {} : exports);
