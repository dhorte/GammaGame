
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

    /* Terrain kinds */
    Warlock.NO_KIND = -1;
    Warlock.FERTILE = 0;
    Warlock.BARREN  = 1;
    Warlock.SNOWY   = 2;

    /* GLOBAL VARIABLES. */

    Warlock.mapHeight = 0;
    Warlock.mapWidth = 0;
    Warlock.hexes = [];            // 2d array of all hexes on the map.
    Warlock.selectedUnit = null;   // The currently selected unit.
    Warlock.moveHexes = [];        // The hexes that the selected unit can move to.
    Warlock.moveRemain = {};       // For each hex in moveHexes, cost of moving there.
    Warlock.blockClick = false;    // Used to prevent a click event after dragging.

})( window.Warlock = window.Warlock || {} );


/*
 * Map stuff.
 * A default map object and the function
 * loadMap -> takes a map object and loads it into the UI.
 * clickFunc -> handle mouse clicks on the game map
 * adjustPos -> create dragBoundFuncs with retangular shapes.
 * calcNeighbors -> find all the neighbor hexes of a particular hex.
 */
(function( Warlock, undefined ) {

    Warlock.calcNeighbors = function(hex) {
        var row = hex.warlock.row;
        var col = hex.warlock.col;

        var num_rows = Warlock.hexes.length;
        var num_cols = Warlock.hexes[1].length;

        var hexes = Warlock.hexes;
        var nbs = []

        if( col > 0 ) nbs.push( hexes[row][col - 1] );
        if( row % 2 == 0 ) {
            if( col < num_cols - 2 ) {
                nbs.push( hexes[row][col + 1] );
            }
            if( row > 0 ) {
                nbs.push( hexes[row - 1][col    ] );
                nbs.push( hexes[row - 1][col + 1] );
            }
            if( row < num_rows - 1 ) {
                nbs.push( hexes[row + 1][col    ] );
                nbs.push( hexes[row + 1][col + 1] );
            }
        }
        else {
            if( col < num_cols - 1 ) {
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
    };

    /*
     * Create a dragBoundFunc that restricts movement to be withing a rectangle, specified
     * by the bounds minx, miny, maxx, maxy.
     * @param pos is the pos that is usually passed to the dragBoundFunc.
     */
    Warlock.adjustPos = function(pos, bounds) {
        var lowerX = pos.x < bounds.minx ? bounds.minx : pos.x;
        var lowerY = pos.y < bounds.miny ? bounds.miny : pos.y;
        var newX = pos.x > bounds.maxx ? bounds.maxx : lowerX;
        var newY = pos.y > bounds.maxy ? bounds.maxy : lowerY;
        return {
            x: newX,
            y: newY
        };
    }


    Warlock.clickFunc = function(event) {
        var clickTarget = event.shape.warlock.clickDelegation;

        /* After a drag event, we don't want to do any clicking. */
        if( Warlock.blockClick ) {
            console.log("blockClick");
            Warlock.blockClick = false;
            return;
        }

        // console.log('click on: ' + clickTarget.getName());
        // console.log('    kind: ' + clickTarget.warlock.kind);

        if( clickTarget.warlock.kind == 'hex' ) {
            console.log('click on a hex');
            var attrs = clickTarget.warlock;

            /* Click on a unit. */
            if( attrs.unit != null ) {
                if( event.which == Warlock.LEFT_CLICK ) {
                    Warlock.selectUnit(attrs.unit);
                }
            }

            /* Click on an empty hex. */
            else {
                if( event.which == Warlock.LEFT_CLICK ) {
                    Warlock.unselectUnit();
                }

                else if( event.which == Warlock.RIGHT_CLICK ) {
                    Warlock.moveSelectedUnit(clickTarget);
                }
            }
        }
        else {
            console.log('click on something else');
        }

        Warlock.ui.redraw();
    };

    Warlock.defaultMap = {
        name: "default",
        rows: 15,
        cols: 15,
        hexes: []
    };

    /* Create new hexes for the new map. */
    var rowCount = 0;
    var colCount = 0;
    var rowOffset = (0.5 + Warlock.SIN_PI_6) * Warlock.HEX_RAD;
    var colOffset = 0;
    var yCoord = rowOffset;
    var numCols = Warlock.defaultMap.cols;
    while( rowCount < Warlock.defaultMap.rows ) {

        var hexRow = [];

        /* Set the column offset. */
        if( rowCount % 2 == 1 ) colOffset = Warlock.HALF_HEX_WIDTH;
        else colOffset = Warlock.HEX_WIDTH;

        /* 
         * Set the number of hexs per row.
         * If the odd numbered rows are one longer than the even numbered rows, the
         * corners of the map turn out nicer.
         */
        if( rowCount % 2 == 0 ) numCols -= 1
        else numCols += 1

        while( colCount < numCols ) {

            var xCoord = colCount * Warlock.HEX_WIDTH + colOffset;

            var background = new Kinetic.RegularPolygon({
                sides: 6,
                radius: Warlock.HEX_RAD,
                fill: 'magenta',      // Use this to start so that unset ones stand out.
                stroke: 'black',
                strokeWidth: 1,
                name: 'hex background ' + rowCount + ', ' + colCount
            });

            var blueHighlight = new Kinetic.RegularPolygon({
                sides: 6,
                radius: Warlock.HEX_RAD * 0.95,
                stroke: 'blue',
                strokeWidth: 1.5,
                visible: false,
                name: 'hex blueHighlight ' + rowCount + ', ' + colCount
            });

            var redHighlight = new Kinetic.RegularPolygon({
                sides: 6,
                radius: Warlock.HEX_RAD * 0.95,
                stroke: 'red',
                strokeWidth: 1.5,
                visible: false,
                name: 'hex redHighlight ' + rowCount + ', ' + colCount
            });

            var hex = new Kinetic.Group({
                x: xCoord,
                y: yCoord,
                name: 'hex group ' + rowCount + ', ' + colCount
            });
            hex.on('click', Warlock.clickFunc);
            hex.warlock = {
                kind: 'hex',
                clickDelegation: hex,
                hex: hex,

                /* Components of this hex. */
                background: background,
                blueHighlight: blueHighlight,
                redHighlight: redHighlight,

                /* Elements on this hex. */
                unit: null,

                /* Terrain information. */
                terrain: {
                    height: Warlock.NO_HEIGHT,
                    kind: Warlock.NO_KIND
                },

                /* Position information. */
                row: rowCount,
                col: colCount,
                diag: colCount + Math.floor( rowCount / 2 ),
                hashKey: '' + rowCount + ',' + colCount,

                /* Do additional adding logic here, and add to the group. */
                add: function(elem) {
                    elem.warlock = elem.warlock || {};
                    elem.warlock.clickDelegation = this.hex;
                    elem.warlock.hex = this.hex;
                    this.hex.add(elem);
                },

                moveUnit: function(destHex) {
                    console.log( "moveUnit" );
                    console.assert( this.unit != null );
                    destHex.warlock.unit = this.unit;
                    this.unit.moveTo(destHex);
                    this.unit.warlock.clickDelegation = destHex;
                    this.unit.warlock.hex = destHex;
                    this.unit = null;
                },

                getNeighbors: function() {
                    if( this.neighbors === undefined ) {
                        this.neighbors = Warlock.calcNeighbors( this.hex );
                    }
                    return this.neighbors;
                }
            };

            /* Join everything together. */
            hex.warlock.add(background);
            hex.warlock.add(blueHighlight);
            hex.warlock.add(redHighlight);

            /* Update values. */
            hexRow.push(hex);
            colCount += 1;
        }
        
        /* Update values. */
        Warlock.defaultMap.hexes.push(hexRow);
        yCoord += Warlock.HEX_RAD * 1.5;
        rowCount += 1;
        colCount = 0;
    }

    /* Load a map, given the details in the form of a map object. */
    Warlock.loadMap = function(map) {

        /* Clear the old map. */
        Warlock.ui.mapLayer.removeChildren();
        Warlock.moveHexes = [];
        Warlock.selectedUnit = null;

        /* Set some global variables. */
        Warlock.mapHeight = (Warlock.defaultMap.rows * Warlock.HEX_RAD * 3 / 2) + (Warlock.HEX_RAD / 2);
        Warlock.mapWidth = Warlock.defaultMap.cols * Warlock.HEX_WIDTH;

        /* Add the background for the map. */
        Warlock.ui.background = new Kinetic.Rect({
            height: Warlock.mapHeight,
            width: Warlock.mapWidth,
            x: 0,
            y: 0,
            fill: 'gray',
            strokeWidth: 0
        });
        Warlock.ui.mapLayer.add(Warlock.ui.background);

        /* Populate the world with the map hexes. */
        Warlock.hexes = map.hexes;
        for (row in map.hexes) {
            for( col in map.hexes[row] ) {
                Warlock.ui.mapLayer.add(map.hexes[row][col]);
            }
        }

        /* Update the drag settings for the map. */
        Warlock.ui.mapLayer.setDraggable(true);
        Warlock.ui.mapLayer.setDragBoundFunc(function(pos) {
            return Warlock.adjustPos(pos, {
                maxx: 0,
                maxy: 0,
                minx: Warlock.ui.stage.getWidth() - Warlock.mapWidth,
                miny: Warlock.ui.stage.getHeight() - Warlock.mapHeight
            });
        });
        
        Warlock.ui.redraw();
    };

})( window.Warlock = window.Warlock || {} );

/*
 * Players
 */
(function( Warlock, undefined ) {
    Warlock.createPlayer = function(config) {
        return config;
    };

    Warlock.defaultPlayer0 = Warlock.createPlayer({
        id: 0,
        color: 'red'
    });

    Warlock.defaultPlayer1 = Warlock.createPlayer({
        id: 1,
        color: 'blue'
    });

})( window.Warlock = window.Warlock || {} );

/*
 * Units.
 * addUnit -> Put a new unit on the map.
 * createUnit -> create and return a new unit object
 * selectUnit -> 
 * unselectUnit ->
 * moveSelectedUnit ->
 * moveCost(unit, hex) -> cost for particular unit to move onto given hex
 */
(function( Warlock, undefined ) {
    Warlock.moveCost = function(unit, hex) {
        if( hex.warlock.unit != null && hex.warlock.unit.player != unit.warlock.player ) {
            return Number.MAX_VALUE;
        }
        else {
            return 1;
        }
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
            Warlock.moveHexes[i].warlock.redHighlight.setVisible(false);
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
            }
            else {
                Warlock.moveHexes[i].warlock.redHighlight.setVisible(true);
            }
        }
    };

    Warlock.moveSelectedUnit = function(destHex) {
        console.log( "moveSelectedUnit to " + destHex.getName() );

        /* Pre-conditions */
        console.assert( destHex !== undefined );

        /* Convenience declarations */
        var unit = Warlock.selectedUnit;

        if( unit != null && $.inArray(destHex, Warlock.moveHexes) >= 0 ) {
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
        hex.warlock.unit = unit;
        hex.warlock.add(unit);
        Warlock.ui.redraw();
    };

    Warlock.createUnit = function(config) {
        console.log( "createUnit" );
        var basic_attrs = {
            radius: Warlock.HEX_RAD * 0.7,
            fill: config.player.color,
            stroke: 'black',
            strokeWidth: 1,
            name: config.name
        };

        var circle = new Kinetic.Circle(basic_attrs);
        circle.warlock = config;
        return circle;
    };

    Warlock.defaultUnit0 = Warlock.createUnit({
        name: 'warriors',
        player: Warlock.defaultPlayer0,
        base: {
            move: 4,
            hp: 24
        },
        current: {
            move: 4,
            hp: 24
        }
    });

    Warlock.defaultUnit1 = Warlock.createUnit({
        name: 'warriors',
        player: Warlock.defaultPlayer1,
        base: {
            move: 4,
            hp: 24
        },
        current: {
            move: 4,
            hp: 24
        }
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
            width: 720,
            height: 350
        });

        /* Map layer. */

        Warlock.ui.mapLayer = new Kinetic.Layer({
            // draggable: true,
            // dragBoundFunc: function(pos) {
            //     return Warlock.adjustPos(pos, {
            //         maxx: 0,
            //         maxy: 0,
            //         minx: Warlock.ui.stage.getWidth() - Warlock.MAP_WIDTH,
            //         miny: Warlock.ui.stage.getHeight() - Warlock.MAP_HEIGHT
            //     });
            // }
        });
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
            x: 1,
            y: Warlock.ui.stage.getHeight() - 151,
            stroke: '#555',
            strokeWidth: 3,
            fill: '#ddd',
            width: 200,
            height: 150,
            cornerRadius: 10,
            opacity: 0.5
        });
        Warlock.ui.infoLayer.add(Warlock.ui.unitInfoRect);

        Warlock.ui.unitInfoText = new Kinetic.Text({
            x: 0,
            y: 200,
            text: 'UNIT INFO',
            fontSize: 18,
            fontFamily: 'Calibri',
            fill: '#555',
            width: 200,
            padding: 20,
            align: 'center'
        });
        Warlock.ui.infoLayer.add(Warlock.ui.unitInfoText);

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
            })            
        });
        

        /* Add layers to stage. */
        Warlock.ui.stage.add(Warlock.ui.mapLayer);
        Warlock.ui.stage.add(Warlock.ui.infoLayer);

        /* Create some basic ui functions. */
        Warlock.ui.redraw = function() {
            console.log( "redraw" );
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

        Warlock.loadMap(Warlock.defaultMap);
        Warlock.addUnit(Warlock.defaultUnit0, Warlock.hexes[2][2]);
        Warlock.addUnit(Warlock.defaultUnit1, Warlock.hexes[3][5]);

    })( window.Warlock = window.Warlock || {} );

});
    
