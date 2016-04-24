var express = require('express');
var router = express.Router();
var request = require('request');


/* GET home page. */
router.get('/', function(req, res) {

  res.render('index');
});

/**
 * Super simple proxy for fetching the DOM of other domains.
 * I do this to get around CORS restrictions.
 */
router.get('/fetchUrl', function(req, res) {

  var url = req.query.url;

  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      return res.send(body);
    }
    res.send('');
  })
});

module.exports = router;
