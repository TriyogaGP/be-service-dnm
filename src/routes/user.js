const { Router } = require('express');
const {
  getAdmin,
  getAdminbyUid,
  postAdmin,
  getDataDashboardTransaksi,
  getDataDashboardTransaksiDaily,
  getDataDashboardShipping,
  getDataDashboardOrderCourier,
  getDataDashboardUserActive,
  getDataDashboardProduct,
  getDataDashboardDetailUserActive,
  getDataDashboardDetailOrderUserActive,
  getDataOrder,
  getOrderSummaryByProduct,
  getProductVariant,
  getLeaderOrderByProduct,
  getDetailOrderLeader,
  getConsumer,
  getSurveiDNM,
  getDataWHStk,
  getRegistInApps,
  reloadDashboardTransaksi,
  reloadDashboardTransaksiDaily,
  reloadDashboardUserActive,
  checkMemberDetailKNET,
  checkPayment,
  checkShippingStatus,
  hitUpdateStatus,
  hitOrderManual,
  hitCODConfirm,
  hitKeranjangOrder,
  hitUnhideProductPackage,
  
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
    
  route.route('/data-dashboard-transaksi')
    .get(verifyToken, getDataDashboardTransaksi(models))
    
  route.route('/data-dashboard-transaksi-daily')
    .get(verifyToken, getDataDashboardTransaksiDaily(models))

  route.route('/data-dashboard-user-active')
    .get(verifyToken, getDataDashboardUserActive(models))

  route.route('/data-dashboard-shipping')
    .get(verifyToken, getDataDashboardShipping())

  route.route('/data-dashboard-order-courier')
    .get(verifyToken, getDataDashboardOrderCourier())

  route.route('/data-dashboard-product')
    .get(verifyToken, getDataDashboardProduct())
    
  route.route('/data-dashboard-detail-user-active')
    .get(verifyToken, getDataDashboardDetailUserActive())
    
  route.route('/data-dashboard-detail-order-user-active')
    .get(verifyToken, getDataDashboardDetailOrderUserActive())

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

  route.route('/reload-dashboard-transaksi')
    .get(verifyToken, reloadDashboardTransaksi(models))

  route.route('/reload-dashboard-transaksi-daily')
    .get(verifyToken, reloadDashboardTransaksiDaily(models))

  route.route('/reload-dashboard-user-active')
    .get(verifyToken, reloadDashboardUserActive(models))

  route.route('/check-member-detail/:idMember')
    .get(verifyToken, checkMemberDetailKNET())

  route.route('/check-payment')
    .get(verifyToken, checkPayment())

  route.route('/check-shipping-status')
    .get(verifyToken, checkShippingStatus())
       
  route.route('/hit-update-status')
    .put(verifyToken, hitUpdateStatus())
       
  route.route('/hit-order-manual')
    .get(verifyToken, hitOrderManual())
       
  route.route('/hit-cod-confirmation')
    .get(verifyToken, hitCODConfirm())
       
  route.route('/hit-keranjang-order')
    .get(verifyToken, hitKeranjangOrder())
       
  route.route('/hit-unhide-product-package')
    .get(verifyToken, hitUnhideProductPackage())


  //API
  route.route('/api-whstokist')
    .get(verifyToken, apiDataWHSTK())

  route.route('/download-whstokist')
    .get(downloadDataWHSTK())

  route.route('/testing')
    .get(testing(models))
  
  return route;
}