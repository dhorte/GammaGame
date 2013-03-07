/*
 * Create a special Kinetic.Group that has a drawHit function that only hits on
 * the circle at its base. This allows the image drawn on top to overlap the
 * bounds of the base circle without affecting how the mouse interacts with
 * the unit overall.
 */
var createUnit = function(config) {
    var circle = new Kinetic.Circle({
        x: 0,
        y: 0,
        radius: config.radius,
        fill: config.fill,
        stroke: 'black',
        strokeWidth: 1,

        /* Game data */
        gName: config.gName,
        gHex: config.gHex
    });

    // var image = new Kinetic.Image({
    //     x: -config.baseSize / 2,
    //     y: -config.baseSize / 2,
    //     image: config.unit_img,
    //     width: config.baseSize + 10,
    //     height: config.baseSize - 10,
    // });

    var group = new Kinetic.Group({
        x: config.x,
        y: config.y
    });
    group.on('click', config.clickFunc);

    group.add(circle);
    // group.add(image);
    // group.drawHit = function() {
    //     if(this.isVisible() && this.isListening()) {
    //         circle.drawHit();
    //     }
    // };
    
    return group;
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

    var sinPi6 = Math.sin( Math.PI / 6 );
    var sinPi3 = Math.sin( Math.PI / 3 );

    var hexRows = 15;  // Should always be an odd number to make nice map corners.
    var hexCols = 15;  // Size of longer rows. Even numbered rows will have one less.
    var hexRad = 30;
    var halfWidth = sinPi3 * hexRad;
    var hexWidth = 2 * halfWidth;

    var mapHeight = (hexRows * hexRad * 3 / 2) + (hexRad / 2);
    var mapWidth = hexWidth * hexCols;

    /* GLOBAL GAME VARIABLES. */
    var hexes = [];


    /* UI Elements */

    var stage = new Kinetic.Stage({
        container: 'game-container',
        width: 720,
        height: 350,
        // draggable: true,
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
        if( rowCount % 2 == 0 ) hexCols -= 1
        else hexCols += 1

        while( colCount < hexCols ) {

            var xCoord = colCount * hexWidth + colOffset;

            var gType = randomType();

            var hex = new Kinetic.RegularPolygon({
                x: xCoord,
                y: yCoord,
                sides: 6,
                radius: hexRad,
                fill: gType.color,
                stroke: 'black',
                strokeWidth: 1,

                /* Data for game. */
                gRow: rowCount,
                gCol: colCount,
                gDiag: colCount + Math.floor( rowCount / 2 ),
                gType: gType.name
            });
            hex.on('click', function(event) {
                var hex = event.shape
                alert( "Clicked on hex. row=" + hex.attrs.gRow + " col=" + hex.attrs.gCol + " diag=" + hex.attrs.gDiag )
            });

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
    var unitClickFunc = function(event) {
        var unit = event.shape;
        var hex = unit.attrs.gHex;
        complexText.setText( unit.attrs.gName + '\nrow: ' + hex.attrs.gRow + '\ncol: ' + hex.attrs.gCol + '\ndiag: ' + hex.attrs.gDiag );
        uiLayer.draw();
        // alert( "Clicked on unit at hex. row=" + hex.attrs.gRow + " col=" + hex.attrs.gCol + " diag=" + hex.attrs.gDiag );
    }

    var targetHex = hexes[3][2];
    var unit1 = createUnit({
        x: targetHex.attrs.x,
        y: targetHex.attrs.y,
        radius: hexRad * 0.7,
        fill: 'red',
        gName: 'swordsmen',
        gHex: targetHex,
        clickFunc: unitClickFunc
    });
    mapLayer.add(unit1);
    
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
