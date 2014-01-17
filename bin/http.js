#!/usr/local/bin/node

var express = require('express'),
	Interface = require(__dirname + '/../app/interface'),
	Mapper = require(__dirname + '/../app/mapper').Mapper,
  Http = require("http");

var app = express();
var mapper = new Mapper;

Interface.ensureImplements(mapper, Interface.mapInterface);


app.configure(function () {
	app.use(express.static(__dirname + '/../public'));
  app.use(express.logger('dev'));     /* 'default', 'short', 'tiny', 'dev' */
  app.use(express.bodyParser());
});


app.get('/search', function(req, res) {

  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');

  var q = [];

  if(req.query.text) {
    q.push(req.query.text);
  }

  if(req.query.sex) {
    var sex = [];
    for(var i=0, l=req.query.sex.length; i<l; i++) {
      sex.push('sex:'+req.query.sex[i]);
    }
    q.push('('+sex.join(' OR ')+')');
  }

  if(req.query['birth-min'] || req.query['birth-max']) {
    q.push('birth<int>:[' +
      (req.query['birth-min']?req.query['birth-min']:1900) + ' TO ' + (req.query['birth-max']?req.query['birth-max']:2100) +
      ']'
    );
  }

  if(req.query.city) {
    q.push('city:'+req.query.city);
  }
  if(req.query.orient) {
    var orient = [];
    for(var i=0, l=req.query.orient.length; i<l; i++) {
      orient.push('orient:'+req.query.orient[i]);
    }
    q.push('('+orient.join(' OR ')+')');
  }
  if(req.query.albums) {
    q.push('albums<int>:[1 TO 1000]');
  }

  if(!q.length) {
    q.push('sex:мужчина OR sex:женщина OR sex:пара');
  }

  var skip = req.query.skip ? req.query.skip : 0;
  var limit = req.query.limit ? req.query.limit : 30;

  var lucene = Http.request({
    hostname: 'localhost',
    port: 5984,
    path: '/_fti/local/swinginfo/_design/lucene/search?q='+encodeURIComponent(q.join(' AND '))+'&sort=albums&force_json=true&skip='+skip+'&limit='+limit
  }, function(r) {
      var html = '';
      r.on('data', function(data) {
          html += data;
      });
      r.on('end', function() {
        var json = JSON.parse(html);
        console.log(json);
        res.send(json);
      })
      r.on('error', function(e) {
        console.warn('error: '+e.message);
        res.send({});
      });
  });

  lucene.on('error', function(e) {
    console.warn('problem with request: ' + e.message);
    res.send({});
  });
  lucene.end();
});

app.get('/view/:id', function(req, res) {

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  
    mapper.getUserinfo(req.params.id, function(data) {
		res.send(data);
    }, function(err) {
    	res.send({
    		error: err
    	}, 500);
    });
});

app.all('*', function(req, res){
  res.send({
  	'error': '404 not found'
  }, 404);
});
 
app.listen(3000);

console.log('Listening on port 3000...');