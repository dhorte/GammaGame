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

    var mapHeight = 400;
    var mapWidth = 800;

    var stage = new Kinetic.Stage({
        container: 'game-container',
        width: 720,
        height: 350,
        draggable: true,
        dragBoundFunc: function(pos) {
            return adjustPos(pos, {
                maxx: 0,
                maxy: 0,
                minx: this.getWidth() - mapWidth,
                miny: this.getHeight() - mapHeight
            });
        }
    });

    var unitLayer = new Kinetic.Layer();

    var loader = new PxLoader();
    var ufoImg = loader.addImage('images/ufo.png'); 

    var stayOnMap = function(radius) {
        return function(pos) {
            var bounds = {
                minx: stage.getX() + radius,
                miny: stage.getY() + radius,
                maxx: stage.getX() + mapWidth - radius,
                maxy: stage.getY() + mapHeight - radius
            };

            return adjustPos(pos, bounds);
        }
    }

    // callback that will be run once images are ready 
    loader.addCompletionListener(function() { 

        /* Create a background image. */
        var background = new Kinetic.Rect({
            height: mapHeight,
            width: mapWidth,
            x: 0,
            y: 0,
            fill: 'gray',
            stroke: 'black',
            strokeWidth: 4
        });

        /* Create a unit to add to the canvas. */

        var ufoUnit = create_unit({
            x: stage.getWidth() / 2,
            y: stage.getHeight() / 2,
            baseSize: 120,
            baseStroke: 3,
            unit_img: ufoImg,
            dragBoundFunc: stayOnMap
        });
        
        // add the group to the layer
        unitLayer.add(background);
        unitLayer.add(ufoUnit);

        // add the layer to the stage
        stage.add(unitLayer);
    }); 
    
    // begin downloading images 
    loader.start();     
});
