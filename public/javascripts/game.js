/*
 * Create a special Kinetic.Group that has a drawHit function that only hits on
 * the circle at its base. This allows the image drawn on top to overlap the
 * bounds of the base circle without affecting how the mouse interacts with
 * the unit overall.
 */
var create_unit = function(config) {
    var circle = new Kinetic.Circle({
        x: 0,
        y: 0,
        radius: Math.floor(config.baseSize / 2),
        fill: 'red',
        stroke: 'black',
        strokeWidth: config.baseStroke
    });

    var image = new Kinetic.Image({
        x: -config.baseSize / 2,
        y: -config.baseSize / 2,
        image: config.unit_img,
        width: config.baseSize + 10,
        height: config.baseSize - 10,
    });

    var group = new Kinetic.Group({
        x: config.x,
        y: config.y,
        draggable: true,
        dragBoundFunc: config.dragBoundFunc(circle.getRadius())
    });

    group.add(circle);
    group.add(image);
    group.drawHit = function() {
        if(this.isVisible() && this.isListening()) {
            circle.drawHit();
        }
    };
    
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

$(document).ready(function() {

    var sinPi6 = Math.sin( Math.PI / 6 );
    var sinPi3 = Math.sin( Math.PI / 3 );

    var hexRows = 20;
    var hexCols = 20;
    var hexRad = 24;
    var halfWidth = sinPi3 * hexRad;
    var hexWidth = 2 * halfWidth;

    var mapHeight = (hexRows * hexRad * 3 / 2) + (hexRad / 2);
    var mapWidth = hexWidth * hexCols + halfWidth;

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

        if( rowCount % 2 == 0 ) colOffset = halfWidth;
        else colOffset = hexWidth;

        while( colCount < hexCols ) {

            var xCoord = colCount * hexWidth + colOffset;

            console.log( "" + colCount + ", " + rowCount + " = hex(" + xCoord + ", " + yCoord + ")" );

            var hex = new Kinetic.RegularPolygon({
                x: xCoord,
                y: yCoord,
                sides: 6,
                radius: hexRad,
                fill: 'red',
                stroke: 'black',
                strokeWidth: 1
            });
            mapLayer.add(hex);

            /* Update values. */
            colCount += 1;
        }

        /* Update values. */
        yCoord += hexRad * 1.5;
        rowCount += 1;
        colCount = 0;

        console.log( "rowCount = " + rowCount );
    }
    
    /* 
     * The UI layer.
     * This layer and everything on it will be unaffected by panning.
     */
    var uiLayer = new Kinetic.Layer();
    
    // since this text is inside of a defined area, we can center it using
    // align: 'center'
    var complexText = new Kinetic.Text({
        x: 100,
        y: 60,
        text: 'COMPLEX TEXT\n\nAll the world\'s a stage, and all the men and women merely players. They have their exits and their entrances.',
        fontSize: 18,
        fontFamily: 'Calibri',
        fill: '#555',
        width: 380,
        padding: 20,
        align: 'center'
    });

    var rect = new Kinetic.Rect({
        x: 100,
        y: 60,
        stroke: '#555',
        strokeWidth: 5,
        fill: '#ddd',
        width: 380,
        height: complexText.getHeight(),
        shadowColor: 'black',
        shadowBlur: 10,
        shadowOffset: [10, 10],
        shadowOpacity: 0.2,
        cornerRadius: 10
    });

    uiLayer.add(rect);
    uiLayer.add(complexText);

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
