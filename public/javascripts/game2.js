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
                Warlock.map.getNeighbors(curr).forEach(function(nb) {
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
                Warlock.ui.mapLayer.add(map.hexes[row][col].ui.elem);
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
                remain[hex.getHashKey()] = currentlyHandling;

                /* Find any neighbors that haven't been done, and get ready to do them. */
                var nbs = Warlock.map.getNeighbors(hex);
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
            unit.setMove(Warlock.moveRemain[destHex.getHashKey()]);
            unit.moveToHex(destHex);
            unit.ui.elem.moveTo(destHex.ui.elem);
            Warlock.selectUnit(unit);

            /* Post-conditions */
            console.assert( unit.hex == destHex );
            console.assert( destHex.getUnit() == unit );
        }
    };

    Warlock.addUnit = function(unitConfig) {
        var hex = Warlock.map.hexes[unitConfig.pos.row][unitConfig.pos.col];
        var unit = new Warlock.Unit(unitConfig);
        unit.initializeUI();

        if( hex === undefined ) {
            throw 'unknown hex: ' + unitConfig.pos;
        }

        console.assert(unit.hex == null);
        console.assert(hex.getUnit() == null);

        Warlock.units.push(unit);
        unit.hex = hex;
        hex.setUnit(unit);
        hex.ui.setUnit(unit);
    };

    Warlock.showMoveOutlines = function() {
        for( i in Warlock.moveHexes ) {
            var finalMove = Warlock.moveRemain[Warlock.moveHexes[i].getHashKey()] <= 0;
            var activeUnit = Warlock.selectedUnit.getPlayer() == Warlock.currentPlayer;
            Warlock.moveHexes[i].ui.outline({
                color: finalMove ? 'red' : 'magenta',
                opacity: activeUnit ? 1.0 : 0.6
            });
        }
    };

    Warlock.clearMoveOutlines = function() {
        for (i in Warlock.moveHexes) {
            Warlock.moveHexes[i].ui.outline(false);
        }
    };

    Warlock.showTargetOutlines = function() {
        Warlock.targetHexes.forEach(function(hex) {
            hex.ui.outline({
                color: 'white',
                opacity: 1.0
            });
        });
    };

    Warlock.clearTargetOutlines = function() {
        Warlock.targetHexes.forEach(function(hex) {
            hex.keepHighlight = false;
            hex.ui.outline(false);
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
            if( hex.getUnit() == null ) {
                return false;
            }
            else if( action.getKind() == 'attack' && hex.getUnit().getPlayer() != unit.getPlayer() ) {
                return true;
            }
            else if( action.getKind() == 'heal' && hex.getUnit().getPlayer() == unit.getPlayer() ) {
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
            Warlock.doAttack(Warlock.selectedUnit, Warlock.currentAction, targetHex.getUnit() );
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
 * Extend Warlock.Hex to include the visual elements used for rendering.
 */
(function( Warlock, undefined ) {

    Warlock.Hex.prototype.initializeUI = function() {
        var hexRef = this;
        var row = this.getRow();
        var col = this.getCol();
        var colOffset = this.getRow() % 2 == 1 ? Warlock.HALF_HEX_WIDTH : Warlock.HEX_WIDTH;

        this.ui = {};
        this.ui.keepHighlight = false;

        this.ui.elem = new Kinetic.Group({
            x: col * Warlock.HEX_WIDTH + colOffset,
            y: (0.5 + Warlock.SIN_PI_6 + (1.5 * row)) * Warlock.HEX_RAD,
            name: 'hex elem ' + row + ',' + col,
        });
        
        this.ui.backgroundElem = new Kinetic.RegularPolygon({
            sides: 6,
            radius: Warlock.HEX_RAD,
            fill: this.getTerrain().color,
            stroke: 'black',
            strokeWidth: 1,
            name: 'hex background ' + row + ', ' + col,
        });
        this.ui.elem.add(this.ui.backgroundElem);

        this.ui.outlineElem = new Kinetic.RegularPolygon({
            sides: 6,
            radius: Warlock.HEX_RAD * 0.92,
            stroke: 'blue',
            strokeWidth: 3,
            visible: false,
            name: 'hex outline ' + row + ', ' + col,
        });
        this.ui.elem.add(this.ui.outlineElem);

        this.ui.highlightElem = new Kinetic.RegularPolygon({
            sides: 6,
            radius: this.ui.backgroundElem.getRadius(),
            fill: 'white',
            strokeWidth: 0,
            opacity: 0.2,
            visible: false,
            name: 'hex mouseOver ' + row + ', ' + col,
        });
        this.ui.elem.add(this.ui.highlightElem);

        

        this.ui.elem.on('mouseenter', function(event) {
            if( !hexRef.ui.keepHighlight ) {
                /* Turn on the white highlight to show what is being mouse overed. */
                hexRef.ui.highlight({
                    color: 'white',
                    opacity: 0.3
                });
                Warlock.ui.mapLayer.draw();
            }
        });
        this.ui.elem.on('mouseleave', function(event) {
            if( !hexRef.ui.keepHighlight ) {
                hexRef.ui.highlight(false);
                Warlock.ui.mapLayer.draw();
            }
        });
        this.ui.elem.on('click', function(event) {
            if( Warlock.ui.blockClick ) {
                console.log( 'blockClick' );
                Warlock.ui.blockClick = false;
                return;
            }

            /* Execute action on this target. */
            else if (event.which == Warlock.RIGHT_CLICK &&
                     $.inArray(hexRef, Warlock.targetHexes) >= 0
            ) {
                Warlock.executeAction(hexRef);
            }

            else if( hexRef.getUnit() != null ) {
                if( event.which == Warlock.LEFT_CLICK ) {
                    Warlock.selectUnit(hexRef.getUnit());
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

        this.ui.outline = function(config) {
            if( config === false ) {
                hexRef.ui.outlineElem.setVisible(false);
            }
            else {
                hexRef.ui.outlineElem.setVisible(true);
                hexRef.ui.outlineElem.setStroke(config.color || hexRef.ui.outlineElem.getStroke());
                hexRef.ui.outlineElem.setOpacity(config.opacity || hexRef.ui.outlineElem.getOpacity());
            }
        };

        this.ui.highlight = function(config) {
            if( config === false ) {
                hexRef.ui.highlightElem.setVisible(false);
            }
            else {
                hexRef.ui.highlightElem.setFill(config.color || hexRef.ui.highlightElem.getFill());
                hexRef.ui.highlightElem.setOpacity(config.opacity || hexRef.ui.highlightElem.getOpacity());
                hexRef.ui.highlightElem.setVisible(true);
            }
        };

        this.ui.setUnit = function(unit) {
            console.assert(unit != null);
            hexRef.ui.elem.add(unit.ui.elem)
        };
    };

})( window.Warlock = window.Warlock || {} );




/*
 * Units.
 */
(function( Warlock, undefined ) {

    Warlock.Unit.prototype.initializeUI = function() {
        this.ui = {};
        this.ui.elem = new Kinetic.Circle({
            radius: Warlock.HEX_RAD * 0.5,
            fill: this.getPlayer().color,
            stroke: 'black',
            strokeWidth: 1,
        });
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
            Warlock.ui.blockClick = false;

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
        Warlock.socket.emit('ready', 'from client socket');
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
    
