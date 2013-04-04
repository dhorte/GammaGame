var path = require('path');
var express = require('express.io');
var passport = require('passport');

var Warlock = require('./public/javascripts/warlock-base.js');
var games = {};

var app = express().http().io();

/* Configure Passport */

var GoogleStrategy = require('passport-google').Strategy;

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Google profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Use the GoogleStrategy within Passport.
//   Strategies in passport require a `validate` function, which accept
//   credentials (in this case, an OpenID identifier and profile), and invoke a
//   callback with a user object.
passport.use(new GoogleStrategy({
    returnURL: 'http://localhost:3000/auth/google/return',
    realm: 'http://localhost:3000/'
  },
  function(identifier, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // To keep the example simple, the user's Google profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Google account with a user record in your database,
      // and return that user instead.
      profile.identifier = identifier;
      return done(null, profile);
    });
  }
));


/* Configure App */

app.configure(function() {
    /* Environment variables */
    app.set('port', process.env.PORT || 3000);
    app.set('view engine', 'jade');

    /* Paths */
    app.set('views', __dirname + '/views');
    app.use(express.static(path.join(__dirname, 'public')));

    /* Setup Sessions with Authentication */
    app.use(express.cookieParser());
    app.use(express.session({secret: 'flying yellow monkeys of doom'}));
    app.use(passport.initialize());
    app.use(passport.session());
});


/* Routes */

/* Authentication routes */

/* Session is automatically setup on initial request thanks to express.io */
app.get('/login', function(req, res) {
    res.render('login', { title: 'Login', user: req.user });
});

app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
});

// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve redirecting
//   the user to google.com.  After authenticating, Google will redirect the
//   user back to this application at /auth/google/return
app.get('/auth/google', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

// GET /auth/google/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/google/return', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });


app.get('/', function(req, res) {
    req.session.loginDate = new Date().toString();
    console.log('user: ' + req.user);
    res.render('index', { title: 'Warlock', user: req.user });
});

// Authentication for the socket connection.
app.use(function(req, res, next) {
    console.log('log: %s %s %s', req.method, req.url, req.session.user);
    next();
});    

app.use(function(req, res, next) {
    console.log('Perform authentication: ', req.method, req.url);
    next();
});

// Setup a route for the ready event, and add session data.
app.io.route('ready', function(req) {
    var test = require('./data/test.js');
    var gameId = 0;
    var gameData = {
        gameId: gameId,
        nextId: 0,
        currentPlayerId: 0,
        players: test.players,
        map: test.map,
        units: test.units,
    }

    // Create a game and store it in a global dictionary.
    var game = new Warlock.Game(gameData);
    games[gameId] = game;

    // Add the game id to the session.
    req.session.gameId = gameId;

    // Save the session data, and send the game data to the client.
    req.session.save(function() {
        gameData.loginDate = req.session.loginDate;
        gameData.info = req.data;
        req.io.emit('load-game', gameData);
    });
});

app.io.route('attack', function(req) {
    console.log( 'Received attack command.' );

    // Convert data ids into game objects.
    var game = games[req.session.gameId];
    var attacker = game.getUnit(req.data.attackerId);
    var defender = game.getUnit(req.data.defenderId);
    var action = attacker.getAction(req.data.actionName);

    // Prepare result object.
    var result = {
        attacker: {
            id: req.data.attackerId,
            hpLost: 0,
            actionName: req.data.actionName
        },
        defender: {
            id: req.data.defenderId,
            hpLost: 0,
            actionName: null
        },
    };

    // Determine if attack is legal.
    console.log( 'TODO: determine if attack is legal' );

    // Calculate attack damage.
    result.defender.hpLost = game.calcDamage(attacker, defender, action, true);

    // Calculate counter-attack damage, if applicable.
    if( defender.basicAttack != null && action.getDamageType() == 'melee' ) {
        result.attacker.hpLost = game.calcDamage(defender, attacker, defender.basicAttack, false);
        result.defender.actionName = defender.basicAttack.getName();
    }

    // Apply damage to units.
    game.applyAttackResult(result);

    // Notify client of changes to state.
    req.io.emit('attack-result', result);
});

app.io.route('move', function(req) {
    console.log('Received move command.');

    var game = games[req.session.gameId];
    var unit = game.getUnit(req.data.unitId);
    unit.dest = game.getMap().hexes[req.data.dest.row][req.data.dest.col];

    var result = game.generateMoveResult(unit);
    
    if( result.error == null ) {
        // Move the unit.
        game.applyMoveResult(result);
    }

    // Notify client of changes to state.
    req.io.emit('move-result', result);
});

/* Start app */
app.listen(app.get('port'), function() {
    console.log("Express server listening on port " + app.get('port'))
});
