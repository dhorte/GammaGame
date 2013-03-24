
/**
 * Module dependencies.
 */

var express = require('express');
var passport = require('passport');
var http = require('http');
var path = require('path');
var sio = require('socket.io');

var routes = require('./routes');


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

var app = express();

app.configure(function(){
    app.set('port', process.env.PORT || 3000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.static(path.join(__dirname, 'public')));

    /* 
     * Sessions, including passport authentication.
     * Also use passport.session() middleware, to suppose persistent login sessions.
     */
    app.use(express.cookieParser());
    app.use(express.session({ secret: 'wallowing walruses' }));
    app.use(passport.initialize());
    app.use(passport.session());

    /*
     * Needs to be after passport.initialize.
     * http://stackoverflow.com/questions/10497349/why-does-passport-js-give-me-a-middleware-error
     */
    app.use(app.router);

});

app.configure('development', function(){
    app.use(express.errorHandler());
});

/* Authentication routes */
app.get('/', function(req, res) {
    res.render('index', { title: 'Warlock', user: req.user });
});
    
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

app.get('/kinetic', routes.kinetic);
app.get('/socket', routes.socket);
app.get('/game/:gameid', function(req, res) {
    res.send('Welcome to game: ' + req.params.gameid);
});
app.get('/endturn', function(req, res) {
    res.send('You have ended your turn.');
});

var server = http.createServer(app).listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});

var io = sio.listen(server);

io.sockets.on('connection', function (socket) {
    socket.emit('connect', {});
    socket.on('end turn', function (data) {
        console.log(data);
    });
});
