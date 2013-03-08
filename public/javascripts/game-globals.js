/* GLOBAL CONSTANTS */

const sinPi6 = Math.sin( Math.PI / 6 );
const sinPi3 = Math.sin( Math.PI / 3 );

const hexRows = 15;  // Should always be an odd number to make nice map corners.
const hexCols = 15;  // Size of longer rows. Even numbered rows will have one less.
const hexRad = 30;
const halfWidth = sinPi3 * hexRad;
const hexWidth = 2 * halfWidth;

const mapHeight = (hexRows * hexRad * 3 / 2) + (hexRad / 2);
const mapWidth = hexWidth * hexCols;

const LEFT_CLICK = 1;

/* GLOBAL VARIABLES. */

var hexes = [];            // 2d array of all hexes on the map.
var selectedUnit = null;   // The currently selected unit.
var moveHexes = [];        // The hexes that the selected unit can move to.
var blockClick = false;    // Used to prevent a click event after dragging.


/* GLOBAL FUNCTION DECLARATIONS. */

var redraw = null;
var setUnitDetails = null;
var clearUnitDetails = null;
