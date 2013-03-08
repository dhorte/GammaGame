/* Handle all clicks on UI and map elements. */
var clickFunc = function(event) {
    var elem = event.shape;

    /* After a drag event, we don't want to do any clicking. */
    if( blockClick ) {
        blockClick = false;
        return;
    }

    if( elem.attrs.warlock.uiNode == true ) {
        console.log( 'Click on a UI element.' );
    }
    else if( elem.attrs.warlock.mapNode == true ) {
        console.log( 'Click on a map element.' );

        var hex = elem.attrs.warlock.hex;
        var attrs = hex.attrs.warlock;

        /* Click on a unit. */
        if( attrs.unit != null ) {
            selectUnit(attrs.unit);
        }

        /* Click on a hex. */
        else {
            /* Left click */
            if( event.which == LEFT_CLICK ) {
                unselectUnit();
            }
            
            // else if( event.which == RIGHT_CLICK ) {
            else {
                moveSelectedUnit(hex);
            }
        }
    }
    else {
        console.log( 'Click unknown element.' );
        for( key in elem.attrs ) {
            console.log( key + " -> " + elem.attrs.warlock[key] );
        }
    }
    
    redraw();
}

var dragStartFunc = function(event) {
    blockClick = true;
}

/* No guarantee is made as to the order of the neighbors. */
var neighbors = function(hex) {
    var attrs = hex.attrs.warlock

    var row = attrs.row;
    var col = attrs.col;

    var nbs = []

    if( col > 0 ) nbs.push( hexes[row][col - 1] );
    if( row % 2 == 0 ) {
        if( col < hexCols - 2 ) nbs.push( hexes[row][col + 1] );
        if( row > 0 ) {
            nbs.push( hexes[row - 1][col    ] );
            nbs.push( hexes[row - 1][col + 1] );
        }
        if( row < hexRows - 1 ) {
            nbs.push( hexes[row + 1][col    ] );
            nbs.push( hexes[row + 1][col + 1] );
        }
    }
    else {
        if( col < hexCols - 1 ) {
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
}


var moveSelectedUnit = function(hex) {
    console.log( "moveSelectedUnit" );
    // console.log( selectedUnit != null );
    // console.log( hex !== undefined );
    // console.log( $.inArray(hex, moveHexes) );

    if( selectedUnit != null && hex !== undefined && $.inArray(hex, moveHexes) ) {
        var hexAttrs = hex.attrs.warlock;
        var oldHex = selectedUnit.attrs.warlock.hex;
        var oldHexAttrs = oldHex.attrs.warlock;

        console.log( "moving to " + hexAttrs.row + ", " + hexAttrs.col );
        oldHexAttrs.unit = null;
        hexAttrs.unit = selectedUnit;
        selectedUnit.attrs.warlock.hex = hex;
        selectedUnit.moveTo(hex);
        selectUnit(selectedUnit); // clear the moveHexes and get new ones
    }
    else {
        console.log( "Not moving" );
    }
}

var unselectUnit = function() {
    console.log( "unselectUnit" );

    selectedUnit = null;
    for (i in moveHexes) {
        moveHexes[i].attrs.warlock.blueHighlight.setVisible(false);
    }
    moveHexes = [];
    clearUnitDetails();
}

var selectUnit = function(unit) {
    console.log( "selectUnit" );

    if( selectedUnit != null ) {
        unselectUnit();
    }
    selectedUnit = unit;

    /* Display the selected unit's stats. */
    var unitAttrs = unit.attrs.warlock;
    var hexAttrs = unitAttrs.hex.attrs.warlock;
    setUnitDetails( unitAttrs.name + '\nrow: ' + hexAttrs.row + '\ncol: ' + hexAttrs.col + '\ndiag: ' + hexAttrs.diag );

    /* Display the selected unit's movement potential. */
    var nbs = neighbors(unitAttrs.hex);
    for (i in nbs) {
        nbs[i].attrs.warlock.blueHighlight.setVisible(true);
        moveHexes.push(nbs[i]);
    }
}


/*
 * Create a special Kinetic.Group that has a drawHit function that only hits on
 * the circle at its base. This allows the image drawn on top to overlap the
 * bounds of the base circle without affecting how the mouse interacts with
 * the unit overall.
 */
var createUnit = function(config) {
    var basic_attrs = {
        radius: hexRad * 0.7,
        fill: config.fill,
        stroke: 'black',
        strokeWidth: 1,
    };

    $.extend(config, basic_attrs);
    var circle = new Kinetic.Circle(config);

    // var image = new Kinetic.Image({
    //     x: -config.baseSize / 2,
    //     y: -config.baseSize / 2,
    //     image: config.unit_img,
    //     width: config.baseSize + 10,
    //     height: config.baseSize - 10,
    // });

    config.warlock.hex.add(circle);
    config.warlock.hex.attrs.warlock.unit = circle;
    // group.add(image);
    // group.drawHit = function() {
    //     if(this.isVisible() && this.isListening()) {
    //         circle.drawHit();
    //     }
    // };
}

/*
 * Create a dragBoundFunc that restricts movement to be withing a rectangle, specified
 * by the bounds minx, miny, maxx, maxy.
 * @param pos is the pos that is usually passed to the dragBoundFunc.
 */
var adjustPos = function(pos, bounds) {
    var lowerX = pos.x < bounds.minx ? bounds.minx : pos.x;
    var lowerY = pos.y < bounds.miny ? bounds.miny : pos.y;
    var newX = pos.x > bounds.maxx ? bounds.maxx : lowerX;
    var newY = pos.y > bounds.maxy ? bounds.maxy : lowerY;
    return {
        x: newX,
        y: newY
    };
}

var PLAINS = {
    name: 'plains',
    color: '#40FF00'
}
var FOREST = {
    name: 'forest',
    color: 'green'
}
var HILLS = {
    name: 'hills',
    color: 'brown'
}

var randomType = function() {
    var num = Math.floor( Math.random() * 3 )

    if( num == 0 ) return PLAINS
    else if( num == 1 ) return FOREST
    else if( num == 2 ) return HILLS
    else return 'UNKNOWN'
}


$(document).ready(function() {

    /* Block the browser context menu on the canvas. */
    document
        .querySelector('#game-container')
        .addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });

    /* Initialize the UI */

    var stage = new Kinetic.Stage({
        container: 'game-container',
        width: 720,
        height: 350,
        dragBoundFunc: function(pos) {
            return adjustPos(pos, {
                maxx: 0,
                maxy: 0,
                minx: this.getWidth() - mapWidth,
                miny: this.getHeight() - mapHeight
            });
        }
    });

    /*
     * The MAP layer.
     * This layer, and everything on it, can be panned.
     */

    var mapLayer = new Kinetic.Layer({
        draggable: true,
        dragBoundFunc: function(pos) {
            return adjustPos(pos, {
                maxx: 0,
                maxy: 0,
                minx: stage.getWidth() - mapWidth,
                miny: stage.getHeight() - mapHeight
            });
        }
    });
    mapLayer.on('dragstart', dragStartFunc);

    /* Put a background on the map layer. */
    var background = new Kinetic.Rect({
        height: mapHeight,
        width: mapWidth,
        x: 0,
        y: 0,
        fill: 'gray',
        strokeWidth: 0
    });
    mapLayer.add(background);

    /* Add the hexes to the map layer. */
    var rowCount = 0;
    var colCount = 0;
    var rowOffset = (0.5 + sinPi6) * hexRad;
    var colOffset = 0;
    var yCoord = rowOffset;
    var numCols = hexCols;
    while( rowCount < hexRows ) {

        var hexRow = [];

        /* Set the column offset. */
        if( rowCount % 2 == 1 ) colOffset = halfWidth;
        else colOffset = hexWidth;

        /* 
         * Set the number of hexs per row.
         * If the odd numbered rows are one longer than the even numbered rows, the
         * corners of the map turn out nicer.
         */
        if( rowCount % 2 == 0 ) numCols -= 1
        else numCols += 1

        while( colCount < numCols ) {

            var xCoord = colCount * hexWidth + colOffset;

            var gType = randomType();

            var base = new Kinetic.RegularPolygon({
                sides: 6,
                radius: hexRad,
                fill: gType.color,
                stroke: 'black',
                strokeWidth: 1,
                warlock: {}
            });

            var blueHighlight = new Kinetic.RegularPolygon({
                sides: 6,
                radius: hexRad * 0.95,
                stroke: 'blue',
                strokeWidth: 1.5,
                visible: false,
                warlock: {}
            });

            var redHighlight = new Kinetic.RegularPolygon({
                sides: 6,
                radius: hexRad * 0.95,
                stroke: 'red',
                strokeWidth: 1.5,
                visible: false,
                warlock: {}
            });

            var hex = new Kinetic.Group({
                x: xCoord,
                y: yCoord,

                warlock: {
                    mapNode: true,
                    hex: this,
                    base: base,
                    unit: null,
                    blueHighlight: blueHighlight,
                    redHighlight: redHighlight,
                    row: rowCount,
                    col: colCount,
                    diag: colCount + Math.floor( rowCount / 2 ),
                    terrain: gType.name
                }
            });

            /*
             * These are details that should be put into the warlock dict of all
             * children of the hex group.
             */
            var details = {
                mapNode: true,
                hex: hex
            }

            $.extend( base.attrs.warlock, details );
            $.extend( blueHighlight.attrs.warlock, details );
            $.extend( redHighlight.attrs.warlock, details );

            /* Event binding */
            hex.on('click', clickFunc);

            /* Join everything together. */
            hex.add(base);
            hex.add(blueHighlight);
            mapLayer.add(hex);

            /* Update values. */
            hexRow.push(hex);
            colCount += 1;
        }

        /* Update values. */
        hexes.push(hexRow);
        yCoord += hexRad * 1.5;
        rowCount += 1;
        colCount = 0;

    }


    /*
     * Add some units to the map layer.
     */

    var targetHex = hexes[2][2];
    var unit1 = createUnit({
        /* Unit appearance. */
        fill: 'red',  // This should be the color of the controlling player.

        /* Unit stats. */
        warlock: {
            mapNode: true,
            hex: targetHex,
               
            name: 'warriors',
            base: {
                move: 6,
                hp: 24
            },

            current: {
                move: 6,
                hp: 24
            },

            moveCost: {
                plains: 1,
                forest: 2,
                hills: 3
            }
        }
    });
    
    /* 
     * The UI layer.
     * This layer and everything on it will be unaffected by panning.
     */
    var uiLayer = new Kinetic.Layer();
    
    // since this text is inside of a defined area, we can center it using
    // align: 'center'
    var complexText = new Kinetic.Text({
        x: 0,
        y: 200,
        text: 'COMPLEX TEXT\n\nAll the world\'s a stage, and all the men and women merely players.',
        fontSize: 18,
        fontFamily: 'Calibri',
        fill: '#555',
        width: 200,
        padding: 20,
        align: 'center'
    });

    var rect = new Kinetic.Rect({
        x: 0,
        y: 200,
        stroke: '#555',
        strokeWidth: 5,
        fill: '#ddd',
        width: 200,
        height: complexText.getHeight(),
        shadowColor: 'black',
        shadowBlur: 10,
        shadowOffset: [10, 10],
        shadowOpacity: 0.2,
        cornerRadius: 10,
        opacity: 0.5
    });

    uiLayer.add(rect);
    uiLayer.add(complexText);

    /*
     * Define global functions.
     */

    redraw = function() {
        mapLayer.draw();
        uiLayer.draw();
    }

    setUnitDetails = function(string) {
        complexText.setText( string );
    }

    clearUnitDetails = function() {
        complexText.setText( "" );
    }

    /*
     * Resource loader.
     */

    var loader = new PxLoader();
    var ufoImg = loader.addImage('images/ufo.png'); 

    // callback that will be run once images are ready 
    loader.addCompletionListener(function() { 
        stage.add(mapLayer);
        stage.add(uiLayer);
    }); 
    
    // begin downloading images 
    loader.start();     
});
