
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

    Warlock.LEFT_CLICK = 1;

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
    Warlock.blockClick = false;    // Used to prevent a click event after dragging.

})( window.Warlock = window.Warlock || {} );


/*
 * Map stuff.
 * A default map object and the function
 * loadMap -> takes a map object and loads it into the UI.
 * clickFunc -> handle mouse clicks on the game map
 * adjustPos -> create dragBoundFuncs with retangular shapes.
 */
(function( Warlock, undefined ) {

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
        console.log( "clickFunc" );
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
                strokeWidth: 1
            });

            var blueHighlight = new Kinetic.RegularPolygon({
                sides: 6,
                radius: Warlock.HEX_RAD * 0.95,
                stroke: 'blue',
                strokeWidth: 1.5,
                visible: false
            });

            var redHighlight = new Kinetic.RegularPolygon({
                sides: 6,
                radius: Warlock.HEX_RAD * 0.95,
                stroke: 'red',
                strokeWidth: 1.5,
                visible: false
            });

            var hex = new Kinetic.Group({
                x: xCoord,
                y: yCoord,

            });
            hex.on('click', Warlock.clickFunc);
            hex.warlock = {
                /* Components of this hex. */
                background: background,
                blueHighlight: blueHighlight,
                redHighlight: redHighlight,

                /* Elements on this hex. */
                unit: null,

                /* Terrain information. */
                height: Warlock.NO_HEIGHT,
                kind: Warlock.NO_KIND,

                /* Position information. */
                row: rowCount,
                col: colCount,
                diag: colCount + Math.floor( rowCount / 2 )
            };

            /* Join everything together. */
            hex.add(background);
            hex.add(blueHighlight);
            hex.add(redHighlight);

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

        /* Add the background for the map. */
        Warlock.ui.background = new Kinetic.Rect({
            height: (Warlock.defaultMap.rows * Warlock.HEX_RAD * 3 / 2) + (Warlock.HEX_RAD / 2),
            width: Warlock.defaultMap.cols * Warlock.HEX_WIDTH,
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
        
        Warlock.ui.redraw();
    };

})( window.Warlock = window.Warlock || {} );

/*
 * Units.
 * addUnit -> Put a new unit on the map.
 * createUnit -> create and return a new unit object
 */
(function( Warlock, undefined ) {
    Warlock.addUnit = function(unit, hex) {
        hex.warlock.unit = unit;
        hex.add(unit);
        Warlock.ui.redraw();
    }

    Warlock.createUnit = function(config) {
        console.log( "createUnit" );
        var basic_attrs = {
            radius: Warlock.HEX_RAD * 0.7,
            fill: 'red',
            stroke: 'black',
            strokeWidth: 1,
        };

        var circle = new Kinetic.Circle(basic_attrs);
        circle.warlock = config;
        return circle;
    }

    Warlock.defaultUnit = Warlock.createUnit({
        name: 'warriors',
        base: {
            move: 6,
            hp: 24
        },
        current: {
            move: 6,
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
            draggable: true,
            dragBoundFunc: function(pos) {
                return Warlock.adjustPos(pos, {
                    maxx: 0,
                    maxy: 0,
                    minx: Warlock.ui.stage.getWidth() - Warlock.MAP_WIDTH,
                    miny: Warlock.ui.stage.getHeight() - Warlock.MAP_HEIGHT
                });
            }
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


        /* Add layers to stage. */
        Warlock.ui.stage.add(Warlock.ui.mapLayer);
        Warlock.ui.stage.add(Warlock.ui.infoLayer);

        /* Create some basic ui functions. */
        Warlock.ui.redraw = function() {
            Warlock.ui.mapLayer.draw();
            Warlock.ui.infoLayer.draw();
        };

        Warlock.loadMap(Warlock.defaultMap);
        Warlock.addUnit(Warlock.defaultUnit, Warlock.hexes[2][2]);

    })( window.Warlock = window.Warlock || {} );

});
    
