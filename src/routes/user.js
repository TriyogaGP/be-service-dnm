const { Router } = require('express');
const {
  getAdmin,
  getAdminbyUid,
  postAdmin,
  getDataOrder,
  getOrderSummaryByProduct,
  getProductVariant,
  getLeaderOrderByProduct,
  getDetailOrderLeader,
  getConsumer,
  getRegistInApps,
  getSurveiDNM,
  checkPayment,
  hitUpdateStatus,
  hitOrderManual,
  testing,
} = require('../controllers/user.controller')
const { uploadFile } = require('../middleware/uploadFile')
const { verifyToken } = require('../middleware/VerifyToken');


module.exports = models => {
  const route = Router();
  
  route.route('/admin')
    .get(verifyToken, getAdmin(models))
    .post(verifyToken, postAdmin(models))
    route.route('/admin/:uid')
    .get(verifyToken, getAdminbyUid(models))
    
  route.route('/data-order')
    .get(verifyToken, getDataOrder())
  
  route.route('/data-order-summary-byproduct')
    .put(verifyToken, getOrderSummaryByProduct())
    
  route.route('/data-product-variant')
    .post(verifyToken, getProductVariant())
    
  route.route('/data-leader-order-byproduct')
    .put(verifyToken, getLeaderOrderByProduct())

  route.route('/data-detail-order/:idUser')
    .put(verifyToken, getDetailOrderLeader())

  route.route('/data-consumer')
    .get(verifyToken, getConsumer())
    
  route.route('/data-regist-in-apps')
    .get(verifyToken, getRegistInApps())
    
  route.route('/data-survei-dnm')
    .get(verifyToken, getSurveiDNM())

  route.route('/check-payment')
    .get(verifyToken, checkPayment())
       
  route.route('/hit-update-status')
    .put(verifyToken, hitUpdateStatus())
       
  route.route('/hit-order-manual')
    .get(verifyToken, hitOrderManual())

  route.route('/testing')
    .get(testing(models))
  
  return route;
}