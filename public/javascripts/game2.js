
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
    Warlock.MOUTAINS  = 3;

    /* Terrain environments. */
    Warlock.NO_ENV = -1;
    Warlock.FERTILE = 0;
    Warlock.BARREN  = 1;
    Warlock.SNOWY   = 2;

    /* GLOBAL VARIABLES. */

    Warlock.map = null;

    Warlock.currentPlayer = null;  // player whose turn it currently is
    Warlock.players = [];          // list of all players in the game
    Warlock.units = [];            // list of all units for all players
    Warlock.mapHeight = 0;
    Warlock.mapWidth = 0;
    Warlock.hexes = [];            // 2d array of all hexes on the map.
    Warlock.selectedUnit = null;   // The currently selected unit.
    Warlock.moveHexes = [];        // The hexes that the selected unit can move to.
    Warlock.moveRemain = {};       // For each hex in moveHexes, cost of moving there.
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
            if( unit.warlock.player == Warlock.currentPlayer ) {
                unit.warlock.current.move = unit.warlock.base.move;
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
        var queue = [unit.warlock.hex];
        var remain = {};
        var todo = {};
        todo[unit.warlock.current.move] = [unit.warlock.hex];  // Start with the current hex.
        var currentlyHandling = unit.warlock.current.move;

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
            console.log( 'Currently handling: ' + currentlyHandling );
            for( i in todo[currentlyHandling] ) {
                var hex = todo[currentlyHandling][i];
                done.push(hex);
                remain[hex.warlock.hashKey] = currentlyHandling;

                /* Find any neighbors that haven't been done, and get ready to do them. */
                var nbs = hex.warlock.getNeighbors();
                for( n in nbs ) {
                    if( $.inArray(nbs[n], queue) == -1 ) {
                        var nbCost = Warlock.moveCost(unit, nbs[n]);
                        if( nbCost <= currentlyHandling ) {
                            addHex(nbs[n], currentlyHandling - nbCost);
                        }
                    }
                }

                hex.warlock.ik = currentlyHandling;

                if( done.length < 10 ) {
                    console.log( "REPORT FOR: " + done[done.length - 1].getName() );
                    for( i in done ) {
                        console.log( 'move: ' + done[i].getName() + ' -> ' + done[i].warlock.ik + ' -> ' + remain[done[i].warlock.hashKey] );
                    }
                }

            }

            nextRange();
        };

        for( i in done ) {
            console.log( 'move: ' + done[i].getName() + ' -> ' + done[i].warlock.ik + ' -> ' + remain[done[i].warlock.hashKey] );
        }

        return {
            hexes: done,
            remain: remain
        };
    };

    Warlock.unselectUnit = function() {
        console.log( "unselectUnit" );
        Warlock.selectedUnit = null;
        for (i in Warlock.moveHexes) {
            Warlock.moveHexes[i].warlock.blueHighlight.setVisible(false);
            Warlock.moveHexes[i].warlock.blueHighlight.setOpacity(1.0);
            Warlock.moveHexes[i].warlock.redHighlight.setVisible(false);
            Warlock.moveHexes[i].warlock.redHighlight.setOpacity(1.0);
        }
        Warlock.moveHexes = [];
        Warlock.moveRemain = {};
        Warlock.ui.clearUnitDetails();
    };

    Warlock.selectUnit = function(unit) {
        console.log( "selectUnit" );

        if( Warlock.selectedUnit != null ) {
            Warlock.unselectUnit();
        }
        Warlock.selectedUnit = unit;

        /* Display the selected unit's stats. */
        Warlock.ui.setUnitDetails( unit.warlock.name + '\nhp: ' + unit.warlock.current.hp + '/' + unit.warlock.base.hp + '\nmove: ' + unit.warlock.current.move + '/' + unit.warlock.base.move );

        /* Display the selected unit's movement potential. */
        var hex = unit.warlock.clickDelegation;
        var movement = Warlock.calculateMovement(unit, hex);
        Warlock.moveHexes = movement.hexes;
        Warlock.moveRemain = movement.remain;
        for( i in Warlock.moveHexes ) {
            if( Warlock.moveRemain[Warlock.moveHexes[i].warlock.hashKey] > 0 ) {
                Warlock.moveHexes[i].warlock.blueHighlight.setVisible(true);
                if( unit.warlock.player != Warlock.currentPlayer ) {
                    Warlock.moveHexes[i].warlock.blueHighlight.setOpacity(0.4);
                }
            }
            else {
                Warlock.moveHexes[i].warlock.redHighlight.setVisible(true);
                if( unit.warlock.player != Warlock.currentPlayer ) {
                    Warlock.moveHexes[i].warlock.redHighlight.setOpacity(0.4);
                }
            }
        }
    };

    Warlock.moveSelectedUnit = function(destHex) {
        console.log( "moveSelectedUnit to " + destHex.getName() );

        /* Pre-conditions */
        console.assert( destHex !== undefined );
        console.assert( Warlock.currentPlayer != null );

        /* Convenience declarations */
        var unit = Warlock.selectedUnit;

        if( unit != null && 
            unit.warlock.player == Warlock.currentPlayer &&
            $.inArray(destHex, Warlock.moveHexes) >= 0
          ) {
            console.log( "moveRemain: " + Warlock.moveRemain[destHex.warlock.hashKey] );
            unit.warlock.current.move = Warlock.moveRemain[destHex.warlock.hashKey];
            unit.warlock.hex.warlock.moveUnit(destHex);
            Warlock.selectUnit(unit);

            /* Post-conditions */
            console.assert( unit.warlock.hex == destHex );
            console.assert( destHex.warlock.unit == unit );
        }
    };

    Warlock.addUnit = function(unit, hex) {
        Warlock.units.push(unit);
        console.log( "TODO: implement addUnit" );
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
            this.diag = this.col + Math.floor( this.row / 2 );
            this.hashKey = 'hex' + this.row + ',' + this.col;

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

            this.ui.blueHighlight = new Kinetic.RegularPolygon({
                sides: 6,
                radius: Warlock.HEX_RAD * 0.95,
                stroke: 'blue',
                strokeWidth: 1.5,
                visible: false,
                name: 'hex blueHighlight ' + config.row + ', ' + config.row
            });
            this.elem.add(this.ui.blueHighlight);

            this.ui.redHighlight = new Kinetic.RegularPolygon({
                sides: 6,
                radius: Warlock.HEX_RAD * 0.95,
                stroke: 'red',
                strokeWidth: 1.5,
                visible: false,
                name: 'hex redHighlight ' + config.row + ', ' + config.row
            });
            this.elem.add(this.ui.redHighlight);

            this.ui.whiteHighlight = new Kinetic.RegularPolygon({
                sides: 6,
                radius: this.ui.background.getRadius(),
                fill: 'white',
                strokeWidth: 0,
                opacity: 0.2,
                visible: false,
                name: 'hex mouseOver ' + config.row + ', ' + config.row
            });
            this.elem.add(this.ui.whiteHighlight);
            this.elem.on('mouseenter', function(event) {
                /* Turn on the white highlight to show what is being mouse overed. */
                hexRef.ui.whiteHighlight.setVisible(true);
                Warlock.ui.mapLayer.draw();
            });
            this.elem.on('mouseleave', function(event) {
                hexRef.ui.whiteHighlight.setVisible(false);
                Warlock.ui.mapLayer.draw();
            });
            this.elem.on('click', function(event) {
                if( Warlock.blockClick ) {
                    console.log("blockClick");
                    Warlock.blockClick = false;
                }

                else if( elemRef.unit != null ) {
                    if( event.which == Warlock.LEFT_CLICK ) {
                        Warlock.selectUnit(elemRef.unit);
                    }
                }

                else {
                    if( event.which == Warlock.LEFT_CLICK ) {
                        Warlock.unselectUnit();
                    }

                    else if( event.which == Warlock.RIGHT_CLICK ) {
                        Warlock.moveSelectedUnit(elemRef.elem);
                    }
                }
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
                this._neighbors = Warlock.calcNeighbors(this);
            }
            return this._neighbors;
        }
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
            var hexes = Warlock.hexes;

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
 * Units.
 */
(function( Warlock, undefined ) {

    Warlock.Unit = function(config) {
        this._initUnit(config);
    };

    Warlock.Unit.prototype = {
        _initUnit: function(config) {

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
            this.powerMod = config.powerMod || 0;
            this.damageMod = $.extend(Warlock.damageDict(), config.damageMod);

            /* Create a basic attack for this unit, based on its power. */
            if( config.power > 0 && (config.noAttack !== undefined || config.noAttack == false) ) {
                console.log( "TODO: Create basic attack." );
            }
            
            /* Copy the base values into current, which is where they will be updated. */
            this.current = $.extend({}, this.base);

            /* Create the canvas element that represents this unit. */
            this.elem = new Kinetic.Circle({
                radius: Warlock.HEX_RAD * 0.7,
                fill: this.player.color,
                stroke: 'black',
                strokeWidth: 1,
            });
            this.elem.wk = {};
            this.elem.wk.unit = this;
            this.elem.wk.hex = config.hex || null;
        },

        getElem: function() {
            return this.elem;
        },

        /* Returns the hex where this unit is currently located. */
        getHex: function() {
            return this.elem.wk.hex;
        },

        moveCost: function(hex) {
            if( hex.warlock.unit != null && hex.warlock.unit.getPlayer() != this.player ) {
                return Number.MAX_VALUE;
            }
            else {
                return 1;
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
            console.log( "TODO: implement moveToHex" );
        },
    };


    Warlock.test.unit0 = new Warlock.Unit({
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

    Warlock.test.unit1 = new Warlock.Unit({
        name: 'warriors',
        player: Warlock.test.player1,
        power: 8,
        powerKind: 'melee',
        hp: 24,
        move: 3,
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
        Warlock.ui.mapLayer.on('dragstart', function() {
            /* 
             * We don't want to act on click events that are part of a drag event,
             * so we set blockClick to prevent it.
             */
            Warlock.blockClick = true;
        });



        /* UI Infomation layer. */

        Warlock.ui.infoLayer = new Kinetic.Layer();

        Warlock.ui.unitInfoRect = new Kinetic.Rect({
            stroke: '#555',
            strokeWidth: 3,
            fill: '#ddd',
            width: 200,
            height: 150,
            cornerRadius: 10
        });

        Warlock.ui.unitInfoText = new Kinetic.Text({
            text: 'UNIT INFO',
            fontSize: 18,
            fontFamily: 'Calibri',
            fill: 'black',
            width: Warlock.ui.unitInfoRect.getWidth(),
            padding: 20,
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


        Warlock.ui.endTurnButton = new Kinetic.Rect({
            width: 100,
            height: 30,
            stroke: '#555',
            strokeWidth: 3,
            fill: '#ddd',
            cornerRadius: 10
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
        console.log( Warlock.ui.stage.getWidth() - Warlock.ui.endTurnButton.getWidth() - 1 );
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

        Warlock.ui.setUnitDetails = function(text) {
            Warlock.ui.unitInfoText.setText(text);
            Warlock.ui.infoLayer.draw();
        };

        Warlock.ui.clearUnitDetails = function() {
            Warlock.ui.unitInfoText.setText("");
            Warlock.ui.infoLayer.draw();
        };

        Warlock.loadMap(Warlock.test.map);
        Warlock.addUnit(Warlock.test.unit0, Warlock.test.map.hexes[2][2]);
        Warlock.addUnit(Warlock.test.unit1, Warlock.test.map.hexes[3][5]);
        Warlock.players.push(Warlock.test.player0);
        Warlock.players.push(Warlock.test.player1);
        Warlock.currentPlayer = Warlock.test.player0;

    })( window.Warlock = window.Warlock || {} );

});
    
