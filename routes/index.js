
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Expresso' });
};

exports.kinetic = function(req, res){
    res.render('kinetic', { title: 'Kinetic' });
};
