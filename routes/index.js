
/*
 * GET home page.
 */

exports.index = function(req, res){
    res.render('index', { title: 'Warlock' });
};

exports.kinetic = function(req, res){
    res.render('kinetic', { title: 'Kinetic' });
};

exports.socket = function(req, res){
    res.render('socket');
};
