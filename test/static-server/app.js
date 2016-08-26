// Server of static files
'use strict'

var express = require('express')
var app = module.exports = express()
app.use(express.static(__dirname))
