/*
 * For printing messages to the message console in the game.
 */
(function( Messages, undefined ) {

    Messages.print = function(message) {
        $('#messages').append(message);
        $('#messages').animate({
            scrollTop: $('#messages')[0].scrollHeight
        }, 1000);
    };

    Messages.println = function(message) {
        Messages.print( message );
        Messages.print( '<br>' );
    };

})( window.Messages = window.Messages || {} );



/*
 * namespace
 */
(function( Warlock, undefined ) {
    /* GLOBAL CONSTANTS */

    Warlock.SIN_PI_6 = Math.sin( Math.PI / 6 );
    Warlock.SIN_PI_3 = Math.sin( Math.PI / 3 );

    Warlock.HEX_RAD = 30;
    Warlock.HALF_HEX_WIDTH = Warlock.SIN_PI_3 * Warlock.HEX_RAD;
    Warlock.HEX_WIDTH = 2 * Warlock.HALF_HEX_WIDTH;

    Warlock.LEFT_CLICK = 1;  // for event.which
    Warlock.RIGHT_CLICK = 3;


    /* GLOBAL VARIABLES. */

    Warlock.map = null;

    Warlock.currentPlayer = null;  // player whose turn it currently is
    Warlock.players = {};          // list of all players in the game
    Warlock.units = [];            // list of all units for all players
    Warlock.mapHeight = 0;
    Warlock.mapWidth = 0;
    Warlock.selectedUnit = null;   // The currently selected unit.
    Warlock.moveHexes = [];        // The hexes that the selected unit can move to.
    Warlock.moveRemain = {};       // For each hex in moveHexes, cost of moving there.
    Warlock.targetHexes = [];      // The hexes that the current unit action can target.
    Warlock.blockClick = false;    // Used to prevent a click event after dragging.

    /* Objects used for testing. Should not be included in release. */
    Warlock.test = {};


})( window.Warlock = window.Warlock || {} );


/*
 * Utilities
 */
(function( Warlock, undefined ) {
    Warlock.util = {};
    
    /*
     * Create a dragBoundFunc that restricts movement to be within a rectangle, specified
     * by the bounds minx, miny, maxx, maxy.
     * @param pos is the pos that is usually passed to the dragBoundFunc.
     */
    Warlock.util.adjustPos = function(pos, bounds) {
        var lowerX = pos.x < bounds.minx ? bounds.minx : pos.x;
        var lowerY = pos.y < bounds.miny ? bounds.miny : pos.y;
        var newX = pos.x > bounds.maxx ? bounds.maxx : lowerX;
        var newY = pos.y > bounds.maxy ? bounds.maxy : lowerY;
        return {
            x: newX,
            y: newY
        };
    };

    /**
     * @param hex the center of the disc
     * @param radius number of hexes away to collect (0 = only the center)
     * @returns an array of hexes in the disc
     */
    Warlock.util.hexDisc = function(hex, radius) {
        var disc = [];
        var done = [hex];
        var steps = { 0: [hex] };
        
        for( var i = 0; i <= radius; i ++ ) {
            steps[i + 1] = [];
            steps[i].forEach(function(curr) {
                disc.push(curr);
                curr.getNeighbors().forEach(function(nb) {
                    if( $.inArray(nb, done) == -1 ) {
                        steps[i + 1].push(nb);
                        done.push(nb);
                    }
                });
            });
        }

        return disc;
    };


})( window.Warlock = window.Warlock || {} );


/*
 * Game management functions.
 */
(function( Warlock, undefined ) {
    /* Load a map, given the details in the form of a map object. */
    Warlock.loadMap = function(mapConfig) {

        var map = new Warlock.Map(mapConfig);

        Warlock.map = map;

        /* Clear the old map. */
        Warlock.ui.mapLayer.removeChildren();

        /* Add the background for the map. */
        Warlock.ui.background = new Kinetic.Rect({
            height: map.height + Warlock.ui.stage.getHeight(),
            width: map.width + Warlock.ui.stage.getWidth(),
            x: -Math.floor( Warlock.ui.stage.getWidth() / 2 ),
            y: -Math.floor( Warlock.ui.stage.getHeight() / 2 ),
            fill: 'gray',
            strokeWidth: 0
        });
        Warlock.ui.mapLayer.add(Warlock.ui.background);

        /* Add the hexes from the map to the mapLayer. */
        for( row in map.hexes ) {
            for( col in map.hexes[row] ) {
                Warlock.ui.mapLayer.add(map.hexes[row][col].elem);
            }
        }

        /* Update the drag settings for the map. */
        Warlock.ui.mapLayer.setDraggable(true);
        Warlock.ui.mapLayer.setDragBoundFunc(function(pos) {
            return Warlock.util.adjustPos(pos, {
                maxx: Math.floor( Warlock.ui.stage.getWidth() / 2 ),
                maxy: Math.floor( Warlock.ui.stage.getHeight() / 2 ),
                minx: 1.5 * Warlock.ui.stage.getWidth() - Warlock.ui.background.getWidth(),
                miny: 1.5 * Warlock.ui.stage.getHeight() - Warlock.ui.background.getHeight()
            });
        });
        
        Warlock.ui.redraw();
    };

    /*
     * @return the player whose turn is next
     */
    Warlock.nextPlayer = function() {
        var nextId = Warlock.currentPlayer.id + 1;
        if( ! nextId in Warlock.players ) {
            nextId = 0;
        }
        return Warlock.players[nextId];
    };

    /*
     * @result Turn cleanup is completed, and the next player's turn is begun.
     */
    Warlock.endTurn = function() {
        /* Reset the movement points of all of the current players units. */
        for( i in Warlock.units ) {
            var unit = Warlock.units[i];
            if( unit.getPlayer() == Warlock.currentPlayer ) {
                unit.setMove(unit.base.move);
            }
        }
        
        Warlock.unselectUnit();
        Warlock.currentPlayer = Warlock.nextPlayer();
    }

    /* 
     * Create a new, empty damage dictionary.
     * Useful for calculating damage, storing damage modifiers, etc.
     */
    Warlock.damageDict = function() {
        return {
            melee: 0,
            range: 0,
            life: 0,
            death: 0,
            spirit: 0,
            elemental: 0
        };
    }

    Warlock.calculateMovement = function(unit) {
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
         * then we will never repeat any hexes, and each hex will get the maximum value
         * of remaining movement the first time it is visited.
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
                remain[hex.hashKey] = currentlyHandling;

                /* Find any neighbors that haven't been done, and get ready to do them. */
                var nbs = hex.getNeighbors();
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
    };

    Warlock.unselectUnit = function() {
        Warlock.selectedUnit = null;
        Warlock.clearMoveOutlines();
        Warlock.moveHexes = [];
        Warlock.moveRemain = {};
        Warlock.ui.clearUnitDetails();
    };

    Warlock.selectUnit = function(unit) {
        if( Warlock.selectedUnit != null ) {
            Warlock.unselectUnit();
        }
        Warlock.selectedUnit = unit;

        /* Display the selected unit's stats. */
        Warlock.updatePrimaryUnitStats(unit);

        /* Display the selected unit's movement potential. */
        var hex = unit.hex;
        var movement = Warlock.calculateMovement(unit, hex);
        Warlock.moveHexes = movement.hexes;
        Warlock.moveRemain = movement.remain;
        Warlock.showMoveOutlines();

        /* Display the selected unit's actions. */
        Warlock.ui.setActionButtons(unit);
    };

    Warlock.moveSelectedUnit = function(destHex) {

        /* Pre-conditions */
        console.assert( destHex !== undefined );
        console.assert( destHex.type == 'Hex' );
        console.assert( Warlock.currentPlayer != null );

        /* Convenience declarations */
        var unit = Warlock.selectedUnit;

        if( unit != null && 
            unit.getPlayer() == Warlock.currentPlayer &&
            $.inArray(destHex, Warlock.moveHexes) >= 0
          ) {
            unit.setMove( Warlock.moveRemain[destHex.hashKey] );
            unit.moveToHex(destHex);
            Warlock.selectUnit(unit);

            /* Post-conditions */
            console.assert( unit.hex == destHex );
            console.assert( destHex.unit == unit );
        }
    };

    Warlock.addUnit = function(unitConfig) {
        var hex = Warlock.map.hexes[unitConfig.pos.row][unitConfig.pos.col];
        var unit = new Warlock.Unit(unitConfig);

        if( hex === undefined ) {
            throw 'unknown hex: ' + unitConfig.pos;
        }

        console.assert(unit.hex == null);
        console.assert(hex.unit == null);

        Warlock.units.push(unit);
        unit.hex = hex;
        hex.addUnit(unit);
    };

    Warlock.showMoveOutlines = function() {
        for( i in Warlock.moveHexes ) {
            var finalMove = Warlock.moveRemain[Warlock.moveHexes[i].hashKey] <= 0;
            var activeUnit = Warlock.selectedUnit.getPlayer() == Warlock.currentPlayer;
            Warlock.moveHexes[i].outline({
                color: finalMove ? 'red' : 'magenta',
                opacity: activeUnit ? 1.0 : 0.6
            });
        }
    };

    Warlock.clearMoveOutlines = function() {
        for (i in Warlock.moveHexes) {
            Warlock.moveHexes[i].outline(false);
        }
    };

    Warlock.showTargetOutlines = function() {
        Warlock.targetHexes.forEach(function(hex) {
            hex.outline({
                color: 'white',
                opacity: 1.0
            });
        });
    };

    Warlock.clearTargetOutlines = function() {
        Warlock.targetHexes.forEach(function(hex) {
            hex.keepHighlight = false;
            hex.outline(false);
        });
    }

    Warlock.startAction = function(unit, action) {
        if( unit.getMove() <= 0 ) {
            Messages.println( unit.name + ' does not have enough movement to perform ' + action.getName() );
            return;
        }

        Warlock.clearMoveOutlines();

        /* Add outlines to valid targets. */
        var targetable = Warlock.util.hexDisc(unit.hex, action.getRange());
        Warlock.targetHexes = targetable.filter(function(hex) {
            if( hex.unit == null ) {
                return false;
            }
            else if( action.getKind() == 'attack' && hex.unit.getPlayer() != unit.getPlayer() ) {
                return true;
            }
            else if( action.getKind() == 'heal' && hex.unit.getPlayer() == unit.getPlayer() ) {
                return true;
            }
            else {
                return false;
            }
        });

        var color = 'white';
        if( action.getKind() == 'attack' ) color = 'red'
        else if( action.getKind() == 'heal' ) color = 'green'

        Warlock.showTargetOutlines(color);
        if( Warlock.targetHexes.length > 0 ) {
            console.assert( Warlock.selectedUnit == unit );
            Warlock.currentAction = action;
            Warlock.ui.redraw();
        }
    };

    /*
     * @param unit Warlock.Unit to apply damage to
     * @param amount Number amount of damage to apply
     * @param source String for output message, the cause of the damage
     */
    Warlock.applyDamage = function(unit, amount, source) {
        unit.current.hp -= amount;
        if( unit.current.hp <= 0 ) {
            Messages.println(unit.name + ' has died.');
        };
    };

    Warlock.updatePrimaryUnitStats = function(unit) {
        var text = unit.name + '\nhp: ' + Math.round(unit.current.hp) + '/' + unit.base.hp + '\nmove: ' + unit.getMove() + '/' + unit.base.move;
        Warlock.ui.unitInfoText.setText(text);
    };

    Warlock.updateSecondaryUnitStats = function(unit) {
        console.log( "TODO" );
    };

    Warlock.doAttack = function(attacker, action, defender) {

        var attackerDamage = (function() {
            var power = attacker.power;

            /* Apply all power mods. */
            power *= (1.0 + action.getPowerMod());
            power *= (1.0 + attacker.powerMod);

            /* Calculate damage for all types. */
            var damage = Warlock.damageDict();
            for( key in attacker.damageMod ) {
                damage[key] = power * attacker.damageMod[key];
            };

            /* Add in the base damage. */
            damage[action.getDamageType()] += power;

            /* Apply damage resistance. */
            for( key in damage ) {
                damage[key] -= (damage[key] * defender.resistance[key]);
            };

            var totalDamage = 0;
            for( key in damage ) {
                totalDamage += damage[key];
                console.log( key + ' -> ' + damage[key] );
            };

            return totalDamage;
        })();

        var defenderDamage = (function() {
            if( defender.basicAttack == null ||
                action.getDamageType() != 'melee'
            ) {
                return 0;
            }

            /* Defender always responds with basic attack. */
            var defence = defender.basicAttack;
            var power = defender.power;

            /* Apply all power mods. */
            power *= (1.0 + defence.getPowerMod());
            power *= (1.0 + defender.powerMod);

            /* Calculate damage for all types. */
            var damage = Warlock.damageDict();
            for( key in defender.damageMod ) {
                damage[key] = power * defender.damageMod[key];
            };

            /* Add in the base damage. */
            damage[defence.getDamageType()] += power;

            /* Apply damage resistance. */
            for( key in damage ) {
                damage[key] -= (damage[key] * attacker.resistance[key]);
            };

            var totalDamage = 0;
            for( key in damage ) {
                totalDamage += damage[key];
            };

            return totalDamage;
        })();

        Messages.println(
            sprintf('%(att)s %(attDam).1f -> VS <- %(defDam).1f %(def)s', {
                att: attacker.name, 
                attDam: attackerDamage,
                def: defender.name,
                defDam: defenderDamage
            })
        );

        Warlock.applyDamage(defender, attackerDamage, attacker.name);
        Warlock.applyDamage(attacker, defenderDamage, defender.name);
        attacker.setMove(0); // Attacking uses all of a units movement points.

        Warlock.updatePrimaryUnitStats(attacker);
        Warlock.updateSecondaryUnitStats(defender);

        // for( key in damage ) {
        //     console.log( key + ' ' + damage[key] );
        // };
    };

    Warlock.executeAction = function(targetHex) {
        console.log( "Executing action: " + Warlock.currentAction.getName() );

        if( Warlock.currentAction == null ) {
            console.log( "null current action" );
            return;
        }

        console.assert( Warlock.selectedUnit != null );

        switch(Warlock.currentAction.getKind()) {
        case 'attack':
            Warlock.doAttack(Warlock.selectedUnit, Warlock.currentAction, targetHex.unit );
            break;
        case 'heal':
            console.log( "Heal action." );
            break;
        default:
            console.log( "Unknown action." );
            break;
        }

        Warlock.currentAction = null;
        Warlock.clearTargetOutlines();
        Warlock.selectUnit(Warlock.selectedUnit);
        Warlock.ui.redraw();
    };

})( window.Warlock = window.Warlock || {} );


/*
 * Terrain
 */
(function( Warlock, undefined ) {
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

            /* Display elements. */
            this.elem = new Kinetic.Group();
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

})( window.Warlock = window.Warlock || {} );



/*
 * Hexes
 */
(function( Warlock, undefined ) {

    Warlock.Hex = function(config) {
        this._initHex(config);
        this.setTerrain(new Warlock.Terrain(config.terrain));
    };

    Warlock.Hex.prototype = {
        _initHex: function(config) {

            /* Required for object creation. */
            this.row = config.row;
            this.col = config.col;
            this.terrain = null;

            /* Optional */

            /* Calculated from other values. */
            this.unit = null;
            this.type = 'Hex';
            this.diag = this.col + Math.floor( this.row / 2 );
            this.hashKey = 'hex' + this.row + ',' + this.col;
            this.keepHighlight = false;

            /* Storage container for ui elements. */
            this.ui = {};

            var colOffset = this.row % 2 == 1 ? Warlock.HALF_HEX_WIDTH : Warlock.HEX_WIDTH;

            /* Rendering elements */
            this.elem = new Kinetic.Group({
                x: this.col * Warlock.HEX_WIDTH + colOffset,
                y: (0.5 + Warlock.SIN_PI_6 + (1.5 * this.row)) * Warlock.HEX_RAD,
                name: 'hex elem ' + config.row + ',' + config.col,
            });
            var elemRef = this.elem;
            var hexRef = this;

            this.ui.background = new Kinetic.RegularPolygon({
                sides: 6,
                radius: Warlock.HEX_RAD,
                fill: 'magenta',
                stroke: 'black',
                strokeWidth: 1,
                name: 'hex background ' + config.row + ', ' + config.row
            });
            this.elem.add(this.ui.background);

            this.ui.outline = new Kinetic.RegularPolygon({
                sides: 6,
                radius: Warlock.HEX_RAD * 0.92,
                stroke: 'blue',
                strokeWidth: 3,
                visible: false,
                name: 'hex outline ' + config.row + ', ' + config.row
            });
            this.elem.add(this.ui.outline);

            this.ui.highlight = new Kinetic.RegularPolygon({
                sides: 6,
                radius: this.ui.background.getRadius(),
                fill: 'white',
                strokeWidth: 0,
                opacity: 0.2,
                visible: false,
                name: 'hex mouseOver ' + config.row + ', ' + config.row
            });
            this.elem.add(this.ui.highlight);
            this.elem.on('mouseenter', function(event) {
                if( !hexRef.keepHighlight ) {
                    /* Turn on the white highlight to show what is being mouse overed. */
                    hexRef.highlight({
                        color: 'white',
                        opacity: 0.3
                    });
                    Warlock.ui.mapLayer.draw();
                }
            });
            this.elem.on('mouseleave', function(event) {
                if( !hexRef.keepHighlight ) {
                    hexRef.highlight(false);
                    Warlock.ui.mapLayer.draw();
                }
            });
            this.elem.on('click', function(event) {
                // console.log( 'received click at: ' + elemRef.getName() );

                if( Warlock.blockClick ) {
                    Warlock.blockClick = false;
                    return;
                }

                /* Execute action on this target. */
                else if(
                    event.which == Warlock.RIGHT_CLICK &&
                    $.inArray(hexRef, Warlock.targetHexes) >= 0
                ) {
                    Warlock.executeAction(hexRef);
                }

                else if( hexRef.unit != null ) {
                    if( event.which == Warlock.LEFT_CLICK ) {
                        Warlock.selectUnit(hexRef.unit);
                    }
                }

                else {
                    if( event.which == Warlock.LEFT_CLICK ) {
                        Warlock.unselectUnit();
                    }

                    else if( event.which == Warlock.RIGHT_CLICK ) {
                        Warlock.moveSelectedUnit(hexRef);
                    }
                }

                Warlock.ui.redraw();
            });
        },

        /**
         * cached result of getNeighbors.
         */
        _neighbors: null,

        /**
         * @return All hexes adjacent to this hex.
         */
        getNeighbors: function() {
            if( this._neighbors == null ) {
                this._neighbors = Warlock.map.calcNeighbors(this);
            }
            return this._neighbors;
        },

        getName: function() {
            return this.hashKey;
        },

        addUnit: function(unit) {
            console.assert(this.unit == null);
            this.unit = unit;
            this.elem.add(unit.elem);
        },

        outline: function(config) {
            if( config === false ) {
                this.ui.outline.setVisible(false);
            }
            else {
                this.ui.outline.setVisible(true);
                this.ui.outline.setStroke(config.color || this.ui.outline.getStroke());
                this.ui.outline.setOpacity(config.opacity || this.ui.outline.getOpacity());
            }
        },

        highlight: function(config) {
            if( config === false ) {
                this.ui.highlight.setVisible(false);
            }
            else {
                this.ui.highlight.setFill(config.color || this.ui.highlight.getFill());
                this.ui.highlight.setOpacity(config.opacity || this.ui.highlight.getOpacity());
                this.ui.highlight.setVisible(true);
            }
        },

        setTerrain: function(terrain) {
            this.terrain = terrain;
            this.ui.background.setFill(terrain.color);
        },
    };

})( window.Warlock = window.Warlock || {} );

/*
 * Map stuff.
 */
(function( Warlock, undefined ) {

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
            this.height = (this.rows * Warlock.HEX_RAD * 3 / 2) + (Warlock.HEX_RAD / 2);
            this.width = this.cols * Warlock.HEX_WIDTH;

            /* The hexes that compose the map. */
            this.hexes = [];

            for( row in config.hexes ) {
                this.hexes.push([]);
                for( col in config.hexes[row] ) {
                    this.hexes[row].push(new Warlock.Hex(config.hexes[row][col]));
                }
            }
        },

        calcNeighbors: function(hex) {
            /* Convenience declarations. */
            var row = hex.row;
            var col = hex.col;
            var hexes = Warlock.map.hexes;

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
    };

})( window.Warlock = window.Warlock || {} );



/*
 * Players
 */
(function( Warlock, undefined ) {

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

})( window.Warlock = window.Warlock || {} );

/*
 * Actions
 * Actions are intended to be immutable after their creation. Any mods to them should
 * be applied to the unit who has the action.
 */
(function( Warlock, undefined ) {
    
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

        getName: function() {
            return this.attrs.name;
        },
        getKind: function() {
            return this.attrs.kind;
        },
        getRange: function() {
            return this.attrs.range;
        },
        getDamageType: function() {
            return this.attrs.damageType;
        },
        getPowerMod: function() {
            return this.attrs.powerMod
        },
        getEffects: function() {
            return this.attrs.effects.slice(0);
        },
    };

})( window.Warlock = window.Warlock || {} );

/*
 * Units.
 */
(function( Warlock, undefined ) {

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
            this.type = 'Unit';
            this.powerMod = config.powerMod || 0;
            this.damageMod = $.extend(Warlock.damageDict(), config.damageMod);
            this.resistance = $.extend(Warlock.damageDict(), config.resistance);
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

            /* Create the canvas element that represents this unit. */
            this.elem = new Kinetic.Circle({
                radius: Warlock.HEX_RAD * 0.5,
                fill: this.getPlayer().color,
                stroke: 'black',
                strokeWidth: 1,
            });
            this.elem.wk = {};
            this.elem.wk.unit = this;
            this.elem.wk.hex = config.hex || null;
        },

        getPlayer: function() {
            return Warlock.players[this.player_id];
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

        getElem: function() {
            return this.elem;
        },

        /* Returns the hex where this unit is currently located. */
        getHex: function() {
            return this.elem.wk.hex;
        },

        moveCost: function(hex) {
            if( hex.unit != null && hex.unit.getPlayer() != this.getPlayer() ) {
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
                /* Impassable terrain. */
                if( hex.terrain.height == Warlock.MOUNTAINS ||
                    hex.terrain.height == Warlock.WATER ) return Number.MAX_VALUE;

                /* Vegetation. */
                else if( hex.terrain.veg == Warlock.FOREST ) return 2;
                else if( hex.terrain.veg == Warlock.JUNGLE ) return 2;
                else if( hex.terrain.veg == Warlock.SWAMP ) return 4;

                /* Raw terrain. */
                else if( hex.terrain.height == Warlock.PLAINS ) return 1;
                else if( hex.terrain.height == Warlock.HILLS ) return 2;
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
            this.hex.unit = null;
            this.hex = hex;
            hex.unit = this;
            this.elem.moveTo(hex.elem);
        },
    };

})( window.Warlock = window.Warlock || {} );


$(document).ready(function() {

    /*
     * Create the main UI elements.
     * Need to do this after the document loads because some elements, such as the stage,
     * require DOM elements.
     */
    (function( Warlock, undefined ) {
        Warlock.setupStage = function() {
            Warlock.ui = {};

            Warlock.ui.stage = new Kinetic.Stage({
                container: 'game-container',
                width: 900,
                height: 600
            });

            /* Map layer. */

            Warlock.ui.mapLayer = new Kinetic.Layer();
            Warlock.ui.mapLayer.on('dragstart', function(event) {
                Warlock.dragDist = 0;
                Warlock.dragX = event.x;
                Warlock.dragY = event.y;
            });
            Warlock.ui.mapLayer.on('dragmove', function(event) {
                var dx = event.x - Warlock.dragX;
                var dy = event.y - Warlock.dragY;
                Warlock.dragDist += Math.sqrt( dx * dx + dy * dy );
                Warlock.dragX = event.x;
                Warlock.dragY = event.y;

                if( dragDist > 2 ) {
                    Warlock.blockClick = true;
                }
            });



            /* UI Infomation layer. */

            Warlock.ui.infoLayer = new Kinetic.Layer();

            /* Formatting to use for UI rectangles. */
            var uiRect = function(config) {
                var base = {
                    stroke: '#555',
                    strokeWidth: 3,
                    fill: '#ddd',
                    cornerRadius: 10
                };
                var config = $.extend(base, config);
                return new Kinetic.Rect(config);
            }

            Warlock.ui.unitInfoRect = uiRect({
                width: 150,
                height: 100
            });


            Warlock.ui.unitInfoText = new Kinetic.Text({
                text: 'UNIT INFO',
                fontSize: 18,
                fontFamily: 'Calibri',
                fill: 'black',
                width: Warlock.ui.unitInfoRect.getWidth(),
                padding: 10,
                align: 'center'
            });

            Warlock.ui.unitInfoGroup = new Kinetic.Group({
                opacity: 0.8,
                x: 1,
                y: Warlock.ui.stage.getHeight() - Warlock.ui.unitInfoRect.getHeight() - 1,
            });
            Warlock.ui.unitInfoGroup.add(Warlock.ui.unitInfoRect);
            Warlock.ui.unitInfoGroup.add(Warlock.ui.unitInfoText);
            Warlock.ui.infoLayer.add(Warlock.ui.unitInfoGroup);

            Warlock.ui.endTurnButton = uiRect({
                width: 100,
                height: 30,
            });
            Warlock.ui.endTurnText = new Kinetic.Text({
                text: 'END TURN',
                fontSize: 14,
                fontFamily: 'Calibri',
                fill: 'black',
                width: Warlock.ui.endTurnButton.getWidth(),
                align: 'center',
                y: 8
            });
            Warlock.ui.endTurnGroup = new Kinetic.Group({
                opacity: 0.8,
                x: Warlock.ui.stage.getWidth() - Warlock.ui.endTurnButton.getWidth() - 1,
                y: Warlock.ui.stage.getHeight() - Warlock.ui.endTurnButton.getHeight() - 1
            });
            Warlock.ui.endTurnGroup.add(Warlock.ui.endTurnButton);
            Warlock.ui.endTurnGroup.add(Warlock.ui.endTurnText);
            Warlock.ui.infoLayer.add(Warlock.ui.endTurnGroup);
            Warlock.ui.endTurnGroup.on('click', function(event) {
                $.get("/endturn", function(string) {
                    alert(string)
                    Warlock.endTurn();
                })            
            });


            /* Add layers to stage. */
            Warlock.ui.stage.add(Warlock.ui.mapLayer);
            Warlock.ui.stage.add(Warlock.ui.infoLayer);

            /* Create some basic ui functions. */
            Warlock.ui.redraw = function() {
                Warlock.ui.mapLayer.draw();
                Warlock.ui.infoLayer.draw();
            };

            Warlock.ui.clearUnitDetails = function() {
                Warlock.ui.unitInfoText.setText("");
                Warlock.ui.infoLayer.draw();
            };

            Warlock.ui.actionButtons = [];
            Warlock.ui.clearActionButtons = function() {
                for( i in Warlock.ui.actionButtons ) {
                    Warlock.ui.actionButtons[i].remove();
                }
                Warlock.ui.actionButtons = [];
            };
            Warlock.ui.setActionButtons = function(unit) {
                Warlock.ui.clearActionButtons();

                var actions = unit.actions;

                for( var i = 0; i < actions.length; i++ ) {
                    (function() {
                        var action = actions[i];
                        var rect = uiRect({
                            width: Warlock.ui.unitInfoRect.getWidth(),
                            height: 30
                        });
                        var text = new Kinetic.Text({
                            text: action.getName(),
                            fontSize: 16,
                            fontFamily: 'Calibri',
                            fill: 'black',
                            width: rect.getWidth(),
                            align: 'center',
                            y: 8
                        });
                        var group = new Kinetic.Group({
                            opacity: 0.8,
                            x: 1,
                            y: Warlock.ui.unitInfoGroup.getY() - (30 * (actions.length - i))
                        });
                        group.on('mouseenter', function(event) {
                            group.setOpacity(1.0);
                            Warlock.ui.infoLayer.draw();
                        });
                        group.on('mouseleave', function(event) {
                            group.setOpacity(0.8);
                            Warlock.ui.infoLayer.draw();
                        });
                        group.on('click', function(event) {
                            Warlock.startAction(unit, action);
                        });
                        group.add(rect);
                        group.add(text);
                        Warlock.ui.actionButtons.push(group);
                        Warlock.ui.infoLayer.add(group);
                    })();
                }
            };
        };

        Warlock.socket = io.connect('http://localhost');
        Warlock.socket.emit('ready', prompt('Some data, please.'));
        Warlock.socket.on('load-game', function(data) {
            Messages.println( 'Connected to server.' );
            Messages.println( 'at: ' + data.loginDate );
            Messages.println( 'info: ' + data.info );


            /* Block the browser context menu on the canvas. */
            document
                .querySelector('#game-container')
                .addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                });


            // Only load resources after successful socket connection.
            // The socket connection guarantees that the page has loaded correctly
            // and the resources are really needed.
            Warlock.loader = new PxLoader();

            console.log( 'TODO: Check data to see what resources need to be loaded.' );
            Warlock.loader.addImage('images/ufo.png'); 

            // callback that will be run once images are ready.
            // When all of the images have finished loading, start up the game.
            Warlock.loader.addCompletionListener(function() { 
                console.log( 'Resources loaded.' );
                console.log( 'Starting game.' );
                Warlock.setupStage();
                data.players.forEach(function(player) {
                    Warlock.players[player.id] = player;
                });
                Warlock.loadMap(data.map);
                data.units.forEach(function(unitConfig) {
                    Warlock.addUnit(unitConfig);
                });
                Warlock.currentPlayer = Warlock.players[data.currentPlayerId];
                Warlock.ui.redraw();
            }); 
            
            // begin downloading images 
            Warlock.loader.start();     
        });

    })( window.Warlock = window.Warlock || {} );

});
    
