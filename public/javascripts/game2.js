if ( !Array.prototype.forEach ) {
    Array.prototype.forEach = function(fn, scope) {
        for(var i = 0, len = this.length; i < len; ++i) {
            fn.call(scope, this[i], i, this);
        }
    }
}

if (!Array.prototype.map) {
    Array.prototype.map = function(callback, thisArg) {
        
        var T, A, k;
        
        if (this == null) {
            throw new TypeError(" this is null or not defined");
        }
        
        // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
        var O = Object(this);
        
        // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
        // 3. Let len be ToUint32(lenValue).
        var len = O.length >>> 0;
        
        // 4. If IsCallable(callback) is false, throw a TypeError exception.
        // See: http://es5.github.com/#x9.11
        if (typeof callback !== "function") {
            throw new TypeError(callback + " is not a function");
        }
        
        // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
        if (thisArg) {
            T = thisArg;
        }
        
        // 6. Let A be a new array created as if by the expression new Array(len) where Array is
        // the standard built-in constructor with that name and len is the value of len.
        A = new Array(len);
        
        // 7. Let k be 0
        k = 0;
        
        // 8. Repeat, while k < len
        while(k < len) {
            
            var kValue, mappedValue;
            
            // a. Let Pk be ToString(k).
            //   This is implicit for LHS operands of the in operator
            // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
            //   This step can be combined with c
            // c. If kPresent is true, then
            if (k in O) {
                
                // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
                kValue = O[ k ];
                
                // ii. Let mappedValue be the result of calling the Call internal method of callback
                // with T as the this value and argument list containing kValue, k, and O.
                mappedValue = callback.call(T, kValue, k, O);
                
                // iii. Call the DefineOwnProperty internal method of A with arguments
                // Pk, Property Descriptor {Value: mappedValue, : true, Enumerable: true, Configurable: true},
                // and false.
                
                // In browsers that support Object.defineProperty, use the following:
                // Object.defineProperty(A, Pk, { value: mappedValue, writable: true, enumerable: true, configurable: true });
                
                // For best browser support, use the following:
                A[ k ] = mappedValue;
            }
            // d. Increase k by 1.
            k++;
        }
        
        // 9. return A
        return A;
    };      
}

if (!Array.prototype.filter)
{
    Array.prototype.filter = function(fun /*, thisp */)
    {
        "use strict";
        
        if (this == null)
            throw new TypeError();
        
        var t = Object(this);
        var len = t.length >>> 0;
        if (typeof fun != "function")
            throw new TypeError();
        
        var res = [];
        var thisp = arguments[1];
        for (var i = 0; i < len; i++)
        {
            if (i in t)
            {
                var val = t[i]; // in case fun mutates this
                if (fun.call(thisp, val, i, t))
                    res.push(val);
            }
        }
        
        return res;
    };
}

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

    /* Terrain elevation */
    Warlock.NO_HEIGHT = -1;
    Warlock.WATER     = 0;
    Warlock.PLAINS    = 1;
    Warlock.HILLS     = 2;
    Warlock.MOUNTAINS = 3;

    /* Terrain environments. */
    Warlock.NO_CLIMATE = -1;
    Warlock.FERTILE    = 0;
    Warlock.BARREN     = 1;
    Warlock.SNOWY      = 2;
    Warlock.LAVA       = 3;

    /* Terrain Vegetation. */
    Warlock.CLEAR  = 0;
    Warlock.FOREST = 1;
    Warlock.JUNGLE = 2;
    Warlock.SWAMP  = 3;

    /* GLOBAL VARIABLES. */

    Warlock.map = null;

    Warlock.currentPlayer = null;  // player whose turn it currently is
    Warlock.players = [];          // list of all players in the game
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




    // Warlock.Global = {
    //     _idCounter: 0,
    //     newId: function() {
    //         this._idCounter += 1;
    //         return this._idCounter;
    //     }
    // };



    // Warlock.Node = function(config) {
    //     this._nodeInit(config);
    // };
    // Warlock.Node.prototype = {
    //     _nodeInit: function(config) {
    //         this._id = Warlock.Global.newId();
    //         this.attrs = {};
    //     },

    //     getId: function() {
    //         return this._id;
    //     }
    // }
    // Warlock.Node._addGetter = function(constructor, attr) {
    //     var method = 'get' + attr.charAt(0).toUpperCase() + attr.slice(1);
    //     constructor.prototype[method] = function(arg) {
    //         return this.attrs[attr];
    //     };
    // };



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
    Warlock.loadMap = function(map) {

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
        return Warlock.players[($.inArray(Warlock.currentPlayer, Warlock.players) + 1) % Warlock.players.length];
    };

    /*
     * @result Turn cleanup is completed, and the next player's turn is begun.
     */
    Warlock.endTurn = function() {
        /* Reset the movement points of all of the current players units. */
        for( i in Warlock.units ) {
            var unit = Warlock.units[i];
            if( unit.player == Warlock.currentPlayer ) {
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

    Warlock.canAttack = function(unit, hex) {
        return false;
    };

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
            unit.player == Warlock.currentPlayer &&
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

    Warlock.addUnit = function(unit, hex) {
        console.assert(unit.hex == null);
        console.assert(hex.unit == null);

        Warlock.units.push(unit);
        unit.hex = hex;
        hex.addUnit(unit);
    };

    /* Given a map, generate awesome terrain for it. */
    Warlock.generateTerrain = function(map) {
        for( row in map.hexes ) {
            for( col in map.hexes[row] ) {
                var height = (function() {
                    var x = Math.random();
                    if( x < 0.1 ) return Warlock.WATER
                    else if( x < 0.2 ) return Warlock.MOUNTAINS
                    else if( x < 0.6 ) return Warlock.HILLS
                    else return Warlock.PLAINS
                })();
                map.hexes[row][col].setTerrain(new Warlock.Terrain({
                    height: height,
                    climate: Warlock.FERTILE,
                    vegetation: Warlock.CLEAR
                }));
            }
        }
    };

    Warlock.showMoveOutlines = function() {
        for( i in Warlock.moveHexes ) {
            Warlock.moveHexes[i].outline({
                color: Warlock.moveRemain[Warlock.moveHexes[i].hashKey] > 0 ? 'magenta' : 'red',
                opacity: Warlock.selectedUnit.player == Warlock.currentPlayer ? 1.0 : 0.6
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
            else if( action.getKind() == 'attack' && hex.unit.player != unit.player ) {
                return true;
            }
            else if( action.getKind() == 'heal' && hex.unit.player == unit.player ) {
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
            this.base = {};
            this.color = this._setColor();

            /* Display elements. */
            this.elem = new Kinetic.Group();
        },

        _setColor: function() {
            switch(this.height) {
            case Warlock.WATER:     return 'blue';
            case Warlock.PLAINS:    return '#7CFC00';
            case Warlock.HILLS:     return '#8B4513';
            case Warlock.MOUNTAINS: return '#aaa';
            }
        },

        /* Remember the current state as the base state of this terrain. */
        freeze: function() {
            var tref = this;
            this.base = {
                height: tref.height,
                env: tref.env,
                veg: tref.veg
            };
        },

        getBase: function() {
            return this.base;
        },
    };

})( window.Warlock = window.Warlock || {} );



/*
 * Hexes
 */
(function( Warlock, undefined ) {

    Warlock.Hex = function(config) {
        this._initHex(config);
    };

    Warlock.Hex.prototype = {
        _initHex: function(config) {

            /* Required for object creation. */
            this.row = config.row;
            this.col = config.col;

            /* Optional */
            this.unit = config.unit || null;
            this.terrain = config.terrain || {
                height: Warlock.NO_HEIGHT,
                env: Warlock.NO_ENV
            };

            /* Calculated from other values. */
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

            // this.ui.redHighlight = new Kinetic.RegularPolygon({
            //     sides: 6,
            //     radius: Warlock.HEX_RAD * 0.95,
            //     stroke: 'red',
            //     strokeWidth: 1.5,
            //     visible: false,
            //     name: 'hex redHighlight ' + config.row + ', ' + config.row
            // });
            // this.elem.add(this.ui.redHighlight);

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

            var rowCount = 0;
            var colCount = 0;
            var numCols = this.cols;
            while( rowCount < this.rows ) {
                var hexRow = [];

                /* Alternate the length of the rows to make a nicely shaped map. */
                if( rowCount % 2 == 0 ) numCols -= 1
                else numCols += 1

                while( colCount < numCols ) {
                    var hex = new Warlock.Hex({
                        row: rowCount,
                        col: colCount,
                    });
                    hexRow.push(hex);

                    colCount += 1;
                }

                this.hexes.push(hexRow);
                rowCount += 1;
                colCount = 0;
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

    Warlock.test.map = new Warlock.Map({
        name: 'test map',
        rows: 15,
        cols: 15
    });
    Warlock.generateTerrain(Warlock.test.map);

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

    Warlock.test.player0 = new Warlock.Player({
        id: 0,
        color: 'red'
    });

    Warlock.test.player1 = new Warlock.Player({
        id: 1,
        color: 'blue'
    });

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
            this.player = config.player;
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
            for( i in config.actions ) {
                this.actions.push( config.actions[i] );
            }

            /* Copy the base values into current, which is where they will be updated. */
            this.current = $.extend({}, this.base);

            /* Create the canvas element that represents this unit. */
            this.elem = new Kinetic.Circle({
                radius: Warlock.HEX_RAD * 0.5,
                fill: this.player.color,
                stroke: 'black',
                strokeWidth: 1,
            });
            this.elem.wk = {};
            this.elem.wk.unit = this;
            this.elem.wk.hex = config.hex || null;
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
            if( hex.unit != null && hex.unit.player != this.player ) {
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


    Warlock.test.ratmen = new Warlock.Unit({
        name: 'ratmen',
        player: Warlock.test.player0,
        power: 8,
        powerKind: 'melee',
        hp: 16,
        move: 5,
        damageMod: {
            death: 0.5
        },
    });

    Warlock.test.shamans = new Warlock.Unit({
        name: 'shamans',
        player: Warlock.test.player0,
        power: 10,
        powerKind: 'spirit',
        hp: 20,
        move: 3,
        actions: [
            new Warlock.Action({
                name: 'heal',
                kind: 'heal',
                range: 2,
                damageType: 'life',
            }),
        ],
    });

    Warlock.test.warriors = new Warlock.Unit({
        name: 'warriors',
        player: Warlock.test.player1,
        power: 8,
        powerKind: 'melee',
        hp: 24,
        move: 3,
        resistance: {
            melee: 0.4
        },
    });

})( window.Warlock = window.Warlock || {} );


$(document).ready(function() {

    /* Block the browser context menu on the canvas. */
    document
        .querySelector('#game-container')
        .addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });


    /*
     * Resource loader.
     */

    var loader = new PxLoader();
    var ufoImg = loader.addImage('images/ufo.png'); 

    // callback that will be run once images are ready 
    loader.addCompletionListener(function() { 
        console.log( 'Resources loaded.' );
    }); 
    
    // begin downloading images 
    loader.start();     
});


$(document).ready(function() {

    /*
     * Create the main UI elements.
     * Need to do this after the document loads because some elements, such as the stage,
     * require DOM elements.
     */
    (function( Warlock, undefined ) {
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

        Warlock.socket = io.connect('http://localhost');
        Warlock.socket.on('connect', function(data) {
            Messages.println( 'Connected to server.' );
        });

        Warlock.players.push(Warlock.test.player0);
        Warlock.players.push(Warlock.test.player1);
        Warlock.loadMap(Warlock.test.map);
        Warlock.addUnit(Warlock.test.ratmen, Warlock.test.map.hexes[2][2]);
        Warlock.addUnit(Warlock.test.shamans, Warlock.test.map.hexes[4][1]);
        Warlock.addUnit(Warlock.test.warriors, Warlock.test.map.hexes[3][3]);
        Warlock.currentPlayer = Warlock.test.player0;
        Warlock.ui.redraw();

    })( window.Warlock = window.Warlock || {} );

});
    
