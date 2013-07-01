var Warlock = require( '../public/javascripts/warlock-base.js' );

// Player's initial knowledge should not include information about other players.
// Player's initial knowledge should not include map size.
// Player's initial knowledge should not include hexes except where units can see.
// Moving a unit should add to a player's visible hexes.
// Moving a unit should not reduce a player's visible hexes.
// Moving a unit should add to a player's explored hexes when applicable.
// Encountering another player should reveal information about that player.
// One player should never be able to see another player's city production
// A player should be able to see the borders of all cities in his explored territory.
// A player should be able to see the borders of newly built cities in his explored territory.
// Units should provide visibility.
// The visibility provided by a unit should not be lost until the current player's turn is over.
// Cities should provide visibility.
// Newly captured cities should immediately provide visibility.
