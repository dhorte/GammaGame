// var Warlock = require('./warlock.js');
var Warlock = require('../public/javascripts/warlock-base.js');

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
                if( x < 0.1 ) return Warlock.elevation.WATER
                else if( x < 0.2 ) return Warlock.elevation.MOUNTAINS
                else if( x < 0.6 ) return Warlock.elevation.HILLS
                else return Warlock.elevation.PLAINS
            })();
            map.hexes[row][col].terrain = {
                height: height,
                climate: Warlock.climate.FERTILE,
                vegetation: Warlock.vegetation.CLEAR
            };
        }
    }

    return map;
})();

exports.players = [
    { id: 0, color: 'red' },
    { id: 1, color: 'blue' },
];

exports.units = [
    {
        name: 'shamans',
        player_id: 0,
        power: 10,
        powerKind: 'spirit',
        hp: 20,
        move: 3,
        actions: [
            {
                name: 'heal',
                kind: 'heal',
                range: 2,
                damageType: 'life',
            },
        ],
        pos: { row: 4, col: 1 },
    },
    {
        name: 'ratmen',
        player_id: 0,
        power: 8,
        powerKind: 'melee',
        hp: 16,
        move: 5,
        damageMod: {
            death: 0.5
        },
        pos: { row: 2, col: 2 },
    },
    {
        name: 'warriors',
        player_id: 1,
        power: 8,
        powerKind: 'melee',
        hp: 24,
        move: 3,
        resistance: {
            melee: 0.4
        },
        pos: { row: 3, col: 3 },
    },
];

