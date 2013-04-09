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
    Warlock.game = null;
    Warlock.myPlayerId = -1;

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
                Warlock.game.getMap().getNeighbors(curr).forEach(function(nb) {
                    if( done.indexOf(nb) == -1 ) {
                        steps[i + 1].push(nb);
                        done.push(nb);
                    }
                });
            });
        }

        return disc;
    };


})( window.Warlock = window.Warlock || {} );


(function( Warlock, undefined ) {

    Warlock.UI = function(game) {
        this._initUI(game)
    };

    Warlock.UI.prototype = {
        _initUI: function(game) {
            this.game = game;

            this.selectedUnit = null;   // The currently selected unit.
            this.moveHexes = [];        // The hexes that the selected unit can move to.
            this.moveRemain = {};       // Cost of moving to this hex from current.
            this.targetHexes = [];      // Hexes that the current unit action can target.
            this.actionButtons = [];
            this.currentAction = null;

            this._initElems();          // All of the KineticJS objects used for rendering
            this._initMap();

            /* Initialize all of the units. */
            this.game.getUnits().forEach(function(unit) {
                unit.initializeUI();
                unit.hex.ui.elem.add(unit.ui.elem);
            });

            this.game.addListener(this);

            this.redraw();
        },
        
        _uiRect: function(config) {
            var base = {
                stroke: '#555',
                strokeWidth: 3,
                fill: '#ddd',
                cornerRadius: 10
            };
            var config = $.extend(base, config);
            return new Kinetic.Rect(config);
        },            

        _initElems: function() {

            this.elems = {};

            // STAGE
            this.elems.stage = new Kinetic.Stage({
                container: 'game-container',
                width: 900,
                height: 600
            });


            // MAP LAYER
            // Contains all elements that are on, or can be on, the map, including
            // the hexes, terrains, units, cities, etc.
            // All nodes on the map layer are added when the map and units are loaded.
            this.elems.mapLayer = new Kinetic.Layer();

            // INFO LAYER
            // Contains all information that users need which is not contained on the map
            // layer. This includes unit information, game status, etc. as well as buttons
            // that the user can click to perform actions.
            this.elems.infoLayer = new Kinetic.Layer();

            // UNIT INFO
            // Displays information about the currently selected unit.
            this.elems.unitInfoRect = this._uiRect({
                width: 150,
                height: 100
            });
            this.elems.unitInfoText = new Kinetic.Text({
                text: 'UNIT INFO',
                fontSize: 18,
                fontFamily: 'Calibri',
                fill: 'black',
                width: this.elems.unitInfoRect.getWidth(),
                padding: 10,
                align: 'center'
            });
            this.elems.unitInfoGroup = new Kinetic.Group({
                opacity: 0.8,
                x: 1,
                y: this.elems.stage.getHeight() - this.elems.unitInfoRect.getHeight() - 1,
            });
            this.elems.unitInfoGroup.add(this.elems.unitInfoRect);
            this.elems.unitInfoGroup.add(this.elems.unitInfoText);
            this.elems.infoLayer.add(this.elems.unitInfoGroup);

            // END TURN BUTTON
            // Allows the current player to end his or her turn.
            this.elems.endTurnButton = this._uiRect({
                width: 100,
                height: 30,
            });
            this.elems.endTurnText = new Kinetic.Text({
                text: 'END TURN',
                fontSize: 14,
                fontFamily: 'Calibri',
                fill: 'black',
                width: this.elems.endTurnButton.getWidth(),
                align: 'center',
                y: 8
            });
            this.elems.endTurnGroup = new Kinetic.Group({
                opacity: 0.8,
                x: this.elems.stage.getWidth() - this.elems.endTurnButton.getWidth() - 1,
                y: this.elems.stage.getHeight() - this.elems.endTurnButton.getHeight() - 1
            });
            this.elems.endTurnGroup.add(this.elems.endTurnButton);
            this.elems.endTurnGroup.add(this.elems.endTurnText);
            this.elems.infoLayer.add(this.elems.endTurnGroup);
            this.elems.endTurnGroup.on('click', function(event) {
                if( Warlock.myPlayerId == Warlock.game.getCurrentPlayerId() ) {
                    Warlock.socket.emit('end-turn');
                }
            });


            // Add all of the layers to the stage.
            this.elems.stage.add(this.elems.mapLayer);
            this.elems.stage.add(this.elems.infoLayer);
        },

        _initMap: function() {
            var gameRef = this;
            var map = this.game.getMap();
            var stage = this.elems.stage;

            var mapHeight = (map.getRows() * Warlock.HEX_RAD * 3 / 2) + (Warlock.HEX_RAD / 2);
            var mapWidth = map.getCols() * Warlock.HEX_WIDTH;
            
            /* Add the background for the map. */
            this.elems.background = new Kinetic.Rect({
                height: mapHeight + stage.getHeight(),
                width: mapWidth + stage.getWidth(),
                x: -Math.floor( stage.getWidth() / 2 ),
                y: -Math.floor( stage.getHeight() / 2 ),
                fill: 'gray',
                strokeWidth: 0
            });
            this.elems.mapLayer.add(this.elems.background);

            /* Add the hexes from the map to the mapLayer. */
            var hexes = map.getHexes()
            for( var row in hexes ) {
                for( var col in hexes[row] ) {
                    var hex = hexes[row][col];
                    hex.initializeUI();
                    this.elems.mapLayer.add(hex.ui.elem);
                }
            }

            /* Update the drag settings for the map. */
            this.elems.mapLayer.setDraggable(true);
            this.elems.mapLayer.setDragBoundFunc(function(pos) {
                return Warlock.util.adjustPos(pos, {
                    maxx: Math.floor( stage.getWidth() / 2 ),
                    maxy: Math.floor( stage.getHeight() / 2 ),
                    minx: 1.5 * stage.getWidth() - gameRef.elems.background.getWidth(),
                    miny: 1.5 * stage.getHeight() - gameRef.elems.background.getHeight()
                });
            });
        },

        clearActionButtons: function() {
            this.actionButtons.forEach(function(button) {
                button.remove();
            });
            this.actionButtons = [];
        },

        clearMoveOutlines: function() {
            for( var i in this.moveHexes ) {
                this.moveHexes[i].ui.outline(false);
            }
        },

        clearTargetOutlines: function() {
            this.targetHexes.forEach(function(hex) {
                hex.keepHighlight = false;
                hex.ui.outline(false);
            });
        },

        clearUnitDetails: function() {
            console.log( 'TODO: Roll this into setSelectedUnit(null)' );
            this.elems.unitInfoText.setText("");
            this.elems.infoLayer.draw();
        },

        receive: function(eventName, data) {
            switch(eventName) {

            case 'attack-result':
                var attacker = this.game.getUnit(data.attacker.id);
                var defender = this.game.getUnit(data.defender.id);
                Messages.println(
                    sprintf('%(att)s %(attDam).1f -> VS <- %(defDam).1f %(def)s', {
                        att: attacker.name,
                        attDam: data.defender.hpLost,
                        def: defender.name,
                        defDam: data.attacker.hpLost
                    })
                );
                break;

            case 'unit-death':
                Messages.println( data.name + ' has died.' );
                break;

            case 'unit-move':
                var unit = this.game.getUnit(data.unitId);
                var destHex = this.game.getMap().getHex(data.terminator);
                unit.ui.elem.moveTo(destHex.ui.elem);
                this.selectUnit(unit);
                break;

            case 'unit-removed':
                data.ui.elem.remove();
                break;
            }
        },

        /**
         * Redraw all layers.
         */
        redraw: function() {
            this.elems.mapLayer.draw();
            this.elems.infoLayer.draw();
        },

        selectUnit: function(unit) {
            console.assert(unit !== undefined);

            this.unselectUnit();
            this.selectedUnit = unit;

            // Calculate possible movement.
            var hex = unit.hex;
            var movement = Warlock.game.unitMovement(unit);
            this.moveHexes = movement.hexes;
            this.moveRemain = movement.remain;

            // Display possible movement.
            for( var i in this.moveHexes ) {
                var hex = this.moveHexes[i];
                var finalMove = this.moveRemain[hex.getHashKey()] <= 0;
                var activeUnit = this.selectedUnit.playerId == this.game.getCurrentPlayerId();
                hex.ui.outline({
                    color: finalMove ? 'red' : 'magenta',
                    opacity: activeUnit ? 1.0 : 0.6
                });
            }

            // Display the unit's stats.
            var text = unit.name + '\nhp: ' + Math.round(unit.current.hp) + '/' + unit.base.hp + '\nmove: ' + unit.getMove() + '/' + unit.base.move;
            this.elems.unitInfoText.setText(text);

            // Display the unit's actions.
            this.setActionButtons(unit);
        },

        setActionButtons: function(unit) {
            var uiRef = this;
            var actions = unit.actions;

            this.clearActionButtons();

            for( var i = 0; i < actions.length; i++ ) {
                (function() {
                    var action = actions[i];
                    var rect = uiRef._uiRect({
                        width: uiRef.elems.unitInfoRect.getWidth(),
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
                        y: uiRef.elems.unitInfoGroup.getY() - (rect.getHeight() * (actions.length - i))
                    });
                    group.on('mouseenter', function(event) {
                        group.setOpacity(1.0);
                        uiRef.elems.infoLayer.draw();
                    });
                    group.on('mouseleave', function(event) {
                        group.setOpacity(0.8);
                        uiRef.elems.infoLayer.draw();
                    });
                    group.on('click', function(event) {
                        if( unit.playerId == uiRef.game.getCurrentPlayerId() ) {
                            Warlock.startAction(unit, action);
                        }
                    });
                    group.add(rect);
                    group.add(text);
                    uiRef.actionButtons.push(group);
                    uiRef.elems.infoLayer.add(group);
                })();
            }
        },

        showTargetOutlines: function() {
            this.targetHexes.forEach(function(hex) {
                hex.ui.outline({
                    color: 'white',
                    opacity: 1.0
                });
            });
        },

        unselectUnit: function() {
            this.clearMoveOutlines();
            this.clearTargetOutlines();
            this.clearActionButtons();
            this.selectedUnit = null;
            this.moveHexes = [];
            this.moveRemain = {};
            this.targetHexes = [];
            this.clearUnitDetails();
        },

        updateSecondaryUnitStats: function(unit) {
            console.log( "TODO: display secondary unit stats" );
        },


    };


    /* Create some basic ui functions. */
    

})( window.Warlock = window.Warlock || {} );


/*
 * Game management functions.
 */
(function( Warlock, undefined ) {

    Warlock.startAction = function(unit, action) {
        console.assert( Warlock.ui.selectedUnit == unit );

        if( unit.getMove() <= 0 ) {
            Messages.println( unit.name + ' does not have enough movement to perform ' + action.getName() );
            return;
        }

        Warlock.ui.clearMoveOutlines();

        /* Add outlines to valid targets. */
        var targetable = Warlock.util.hexDisc(unit.hex, action.getRange());
        Warlock.ui.targetHexes = targetable.filter(function(hex) {
            if( hex.getUnit() == null ) {
                return false;
            }
            else if( action.getKind() == 'attack' && hex.getUnit().playerId != unit.playerId ) {
                return true;
            }
            else if( action.getKind() == 'heal' && hex.getUnit().playerId == unit.playerId ) {
                return true;
            }
            else {
                return false;
            }
        });

        var color = 'white';
        if( action.getKind() == 'attack' ) color = 'red'
        else if( action.getKind() == 'heal' ) color = 'green'

        Warlock.ui.showTargetOutlines(color);
        if( Warlock.ui.targetHexes.length > 0 ) {
            Warlock.ui.currentAction = action;
            Warlock.ui.redraw();
        }
    };

    /*
     * @param unit Warlock.Unit to apply damage to
     * @param amount Number amount of damage to apply
     * @param source String for output message, the cause of the damage
     */
    Warlock.applyDamage = function(unit, amount) {
        unit.current.hp -= amount;
        if( unit.current.hp <= 0 ) {
            Messages.println(unit.name + ' has died.');
        };
    };

    Warlock.executeAction = function(targetHex) {
        console.log( "Executing action: " + Warlock.ui.currentAction.getName() );

        if( Warlock.game.getCurrentPlayerId() != Warlock.myPlayerId ) {
            Messages.println( 'Cannot execute actions when it is not your turn.' );
            return;
        }

        if( Warlock.ui.currentAction == null ) {
            console.log( "null current action" );
            return;
        }

        console.assert( Warlock.ui.selectedUnit != null );

        switch(Warlock.ui.currentAction.getKind()) {
        case 'attack':
            Warlock.socket.emit( 'attack', {
                gameId: Warlock.game.getId(),
                attackerId: Warlock.ui.selectedUnit.getId(),
                defenderId: targetHex.getUnit().getId(),
                actionName: Warlock.ui.currentAction.getName(),
            });
            break;
        case 'heal':
            console.log( "Heal action." );
            break;
        default:
            console.log( "Unknown action." );
            break;
        }
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

                /* If a unit is selected, show the shortest path to this point. */
                console.log( 'TODO: show shortest path' );

                Warlock.ui.elems.mapLayer.draw();
            }
        });
        this.ui.elem.on('mouseleave', function(event) {
            if( !hexRef.ui.keepHighlight ) {
                hexRef.ui.highlight(false);
                Warlock.ui.elems.mapLayer.draw();
            }
        });
        this.ui.elem.on('click', function(event) {
            // LEFT CLICK
            if( event.which == Warlock.LEFT_CLICK ) {
                if( hexRef.getUnit() != null ) {
                    Warlock.ui.selectUnit(hexRef.getUnit());
                    Warlock.ui.redraw();
                }

                else if( Warlock.ui.selectedUnit != null ) {
                    Warlock.ui.unselectUnit();
                    Warlock.ui.redraw();
                }
            }
            
            // RIGHT CLICK
            else if( event.which == Warlock.RIGHT_CLICK ) {

                // Perform the current action on the clicked target.
                if( Warlock.ui.targetHexes.indexOf(hexRef) >= 0 ) {
                    Warlock.executeAction(hexRef);
                }

                // Move the currently selected unit.
                else if( Warlock.ui.moveHexes.indexOf(hexRef) >= 0 ) {
                    if( Warlock.myPlayerId != Warlock.game.getCurrentPlayerId() ) {
                        Messages.println( "Can't move units when it is not your turn." );
                        return;
                    }

                    Warlock.ui.selectedUnit.dest = hexRef;
                    Warlock.socket.emit('move', {
                        unitId: Warlock.ui.selectedUnit.getId(),
                        dest: hexRef.getPos(),
                    });
                }
            }
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

        var unitRef = this;
        var getColor = function() {
            var players = Warlock.game.getPlayers();
            var playerId = unitRef.playerId;
            var color = players[playerId].getColor();

            if( color === undefined ) {
                console.assert( false, 'Could not get a valid color for unit elem.' );
            }
            else {
                return color;
            }
        };

        this.ui.elem = new Kinetic.Circle({
            radius: Warlock.HEX_RAD * 0.5,
            fill: getColor(),
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
                Warlock.game = new Warlock.Game(data);
                Warlock.myPlayerId = data.yourPlayerId;
                Warlock.ui = new Warlock.UI(Warlock.game);
                Messages.println( 'You are player ' + Warlock.myPlayerId );
                Messages.println( 'It is player ' + Warlock.game.getCurrentPlayerId() + "'s turn." );
            }); 
            
            // begin downloading images 
            Warlock.loader.start();     
        });

        Warlock.socket.on('attack-result', function(data) {
            Warlock.game.applyAttackResult(data);
            Warlock.ui.currentAction = null;
            Warlock.ui.clearTargetOutlines();
            Warlock.ui.selectUnit(Warlock.ui.selectedUnit);
            Warlock.ui.redraw();
        });

        Warlock.socket.on('move-result', function(data) {
            Messages.println('Received move-result message from socket.');
            if( data.error != null ) {
                Messages.println(data.error);
            }
            else {
                Warlock.game.applyMoveResult(data);
                Warlock.ui.redraw();
            }
        });

        Warlock.socket.on('end-turn-result', function(data) {
            Messages.println('Received end-turn-result message from socket.');
            if( data.error == null || data.error === undefined ) {
                Warlock.game.applyEndTurnResult(data);
                Warlock.ui.unselectUnit();
                Messages.println('It is now player ' + Warlock.game.getCurrentPlayerId() + "'s turn.");
                Warlock.ui.redraw();
            }
            else {
                Messages.println(data.error);
            }
        });

    })( window.Warlock = window.Warlock || {} );

});
    
