var Warlock = require('./warlock.js');

exports.map = (function() {

    var map = {
        name: 'test map',
        rows: 15,
        cols: 15,
        hexes: [],
    };

    // Create naked hexes.
    var rowCount = 0;
    var colCount = 0;
    var numCols = map.cols;
    while( rowCount < map.rows ) {
        var hexRow = [];

        /* Alternate the length of the rows to make a nicely shaped map. */
        if( rowCount % 2 == 0 ) numCols -= 1
        else numCols += 1

        while( colCount < numCols ) {
            hexRow.push({
                row: rowCount,
                col: colCount,
            });
            colCount += 1;
        }

        map.hexes.push(hexRow);
        rowCount += 1;
        colCount = 0;
    }

    // Add terrain to hexes.
    for( row in map.hexes ) {
        for( col in map.hexes[row] ) {
            var height = (function() {
                var x = Math.random();
                if( x < 0.1 ) return Warlock.WATER
                else if( x < 0.2 ) return Warlock.MOUNTAINS
                else if( x < 0.6 ) return Warlock.HILLS
                else return Warlock.PLAINS
            })();
            map.hexes[row][col].terrain = {
                height: height,
                climate: Warlock.FERTILE,
                vegetation: Warlock.CLEAR
            };
        }
    }

    return map;
})();
