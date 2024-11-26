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
  getSurveiDNM,
  getDataWHStk,
  getRegistInApps,
  checkMemberDetailKNET,
  checkPayment,
  hitUpdateStatus,
  hitOrderManual,
  hitCODConfirm,
  
  apiDataWHSTK,
  downloadDataWHSTK,
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
    
  route.route('/data-survei-dnm')
    .get(verifyToken, getSurveiDNM())
  
  route.route('/data-warehouse-stokist')
    .get(verifyToken, getDataWHStk())

  route.route('/data-regist-in-apps')
    .get(verifyToken, getRegistInApps())

  route.route('/check-member-detail/:idMember')
    .get(verifyToken, checkMemberDetailKNET())

  route.route('/check-payment')
    .get(verifyToken, checkPayment())
       
  route.route('/hit-update-status')
    .put(verifyToken, hitUpdateStatus())
       
  route.route('/hit-order-manual')
    .get(verifyToken, hitOrderManual())
       
  route.route('/hit-cod-confirmation')
    .get(verifyToken, hitCODConfirm())


  //API
  route.route('/api-whstokist')
    .get(verifyToken, apiDataWHSTK())

  route.route('/download-whstokist')
    .get(verifyToken, downloadDataWHSTK())

  route.route('/testing')
    .get(testing(models))
  
  return route;
}