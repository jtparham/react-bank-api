const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = "8080";
const router = require("./routing_table")

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.listen(PORT, () => console.log("Server started at port: " + PORT));
app.use('/', router);
module.exports = app;
