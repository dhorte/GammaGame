
/*
 * namespace
 */
(function( Warlock, undefined ) {
    /* GLOBAL CONSTANTS */

    Warlock.SIN_PI_6 = Math.sin( Math.PI / 6 );
    Warlock.SIN_PI_3 = Math.sin( Math.PI / 3 );

    Warlock.HEX_ROWS = 15;  // Use an odd number to make nice map corners.
    Warlock.HEX_COLS = 15;  // Even numbered rows will have one less.
    Warlock.HEX_RAD = 30;
    Warlock.HALF_WIDTH = Warlock.SIN_PI_3 * Warlock.HEX_RAD;
    Warlock.FULL_WIDTH = 2 * Warlock.HALF_WIDTH;

    Warlock.MAP_HEIGHT = (Warlock.HEX_ROWS * Warlock.HEX_RAD * 3 / 2) + (Warlock.HEX_RAD / 2);
    Warlock.MAP_WIDTH = Warlock.HEX_WIDTH * Warlock.HEX_COLS;

    Warlock.LEFT_CLICK = 1;

    /* GLOBAL VARIABLES. */

    Warlock.hexes = [];            // 2d array of all hexes on the map.
    Warlock.selectedUnit = null;   // The currently selected unit.
    Warlock.moveHexes = [];        // The hexes that the selected unit can move to.
    Warlock.blockClick = false;    // Used to prevent a click event after dragging.


    /* GLOBAL FUNCTION DECLARATIONS. */

    Warlock.redraw = null;
    Warlock.setUnitDetails = null;
    Warlock.clearUnitDetails = null;

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
            height: 350,
            dragBoundFunc: function(pos) {
                return adjustPos(pos, {
                    maxx: 0,
                    maxy: 0,
                    minx: this.getWidth() - Warlock.MAP_WIDTH,
                    miny: this.getHeight() - Warlock.MAP_HEIGHT
                });
            }
        });

        /* Map layer. */

        Warlock.ui.mapLayer = new Kinetic.Layer({
            draggable: true,
            dragBoundFunc: function(pos) {
                return adjustPos(pos, {
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

        /* Put a background on the map layer. */
        var background = new Kinetic.Rect({
            height: Warlock.MAP_HEIGHT,
            width: Warlock.MAP_WIDTH,
            x: 0,
            y: 0,
            fill: 'gray',
            strokeWidth: 0
        });
        Warlock.ui.mapLayer.add(background);



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


        /* Create the hexes for the map. */

    })( window.Warlock = window.Warlock || {} );

});
    
