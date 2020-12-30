'use strict';

const jsonData = require('../data.json');

module.exports = ( req, res ) => {
  let planId = req.query.id;
  let plan = jsonData.parker.filter(p => p.id == planId)[0];
  if (!plan) {
    plan = jsonData.tshirt.filter(p => p.id == planId)[0];
  }
  res.json({plan});
};
