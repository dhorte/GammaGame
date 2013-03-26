var path = require('path');
var express = require('express.io');
var passport = require('passport');

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
    // for( key in req ) {
    //     console.log( key + ' -> ' + req[key] );
    // }
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
    req.session.info = req.data;
    req.session.save(function() {
        req.io.emit('load-game', {
            currentPlayerId: 0,
            players: [
                { id: 0, color: 'red' },
                { id: 1, color: 'blue' },
            ],
            map: require( './data/test.js' ).map,
            units: [
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
            ]
        });
    });
});

/* Start app */
app.listen(app.get('port'), function() {
    console.log("Express server listening on port " + app.get('port'))
});
