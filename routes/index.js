
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Warlock' });
};

exports.namespace = function(req, res){
  res.render('index2', { title: 'Warlock' });
};

exports.kinetic = function(req, res){
    res.render('kinetic', { title: 'Kinetic' });
};
