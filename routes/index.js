
/*
 * GET home page.
 */

exports.index = function(req, res){
    res.render('index', { title: 'Warlock', user: req.user });
};

exports.login = function(req, res) {
    if( req.user ) {
        exports.index(req, res);
    }
    else {
        res.render('login', { title: 'Login' });
    }
};



exports.kinetic = function(req, res){
    res.render('kinetic', { title: 'Kinetic' });
};

exports.socket = function(req, res){
    res.render('socket');
};
