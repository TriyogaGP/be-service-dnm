const { Router } = require('express');
const {
  getTransaksiDetail,
  getTransaksiSummary,
  getSalesArea,
  testing,
} = require('../controllers/kmart.controller')
const { uploadFile } = require('../middleware/uploadFile')
const { verifyToken } = require('../middleware/VerifyToken');


module.exports = models => {
  const route = Router();
  
  route.route('/get-transaksi-detail')
    .get(verifyToken, getTransaksiDetail())
  
  route.route('/get-transaksi-summary')
    .get(verifyToken, getTransaksiSummary())
  
  route.route('/get-sales-area')
    .get(verifyToken, getSalesArea())

  route.route('/testing')
    .get(testing(models))
  
  return route;
}