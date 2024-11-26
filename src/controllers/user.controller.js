const {
	response,
	OK,
	NOT_FOUND,
	NO_CONTENT,
	UNAUTHORIZED
} = require('@triyogagp/backend-common/utils/response.utils');
const {
	request
} = require('@triyogagp/backend-common/utils/request.utils');
const {
	encrypt,
	decrypt,
	setNum,
	shuffleArray,
	getRandomArray,
	makeRandom,
	convertDateForDay,
	dateconvert,
	convertDate,
	convertDate3,
	convertDateTime2,
	convertDateTime3,
	splitTime,
	createKSUID,
	pembilang,
	makeRandomAngka,
	uppercaseLetterFirst,
	uppercaseLetterFirst2,
	uppercaseLetterFirst3,
	buildMysqlResponseWithPagination,
	paginate,
	buildOrderQuery,
} = require('@triyogagp/backend-common/utils/helper.utils');
const {
	_allOption,
	_anakOption,
	_wilayahpanjaitanOption,
	_ompuOption,
	_komisariswilayahOption,
	_wilayah2023Option,
	_wilayah2023Cetak,
	_iuranAllData,
	_penanggungjawabAllData,
	_tugasAllData,
} = require('../controllers/helper.service')
const { 
	_buildResponseAdmin,
} = require('../utils/build-response');
const orderServiceConnector = require('@triyogagp/backend-common/connectors/dnm/order-service.connector');
const { Op } = require('sequelize')
const sequelize = require('sequelize')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const excel = require("exceljs");
const ejs = require("ejs");
const pdf = require("html-pdf");
const path = require("path");
const fs = require('fs');
const qs = require('qs')
const _ = require('lodash');
const { DateTime } = require('luxon')
const nodeGeocoder = require('node-geocoder');
const readXlsxFile = require('read-excel-file/node');
const { sequelizeInstance } = require('../configs/db.config');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const id = require('dayjs/locale/id');
const dotenv = require('dotenv');
dotenv.config();
const BASE_URL = `${process.env.BASE_URL}`
const KNET_BASE_URL = `${process.env.KNET_BASE_URL}`
const KNET_PAYMENT_BASE_URL = `${process.env.KNET_PAYMENT_BASE_URL}`

const orderSvc = new orderServiceConnector();

dayjs.extend(utc);
dayjs.extend(timezone);

async function loginKnet () {
	const { data: login } = await request({
		url: `${KNET_BASE_URL}auth/login`,
		method: 'POST',
		data: {
			username: 'app.k-mart2.0_dev',
			password: 'app.k-mart2.0_dev@202103'
		},
		headers: {
			'Content-Type': 'application/json'
		},
	})
	return login
}

async function loginPayment () {
	const { data: login } = await request({
		url: `${KNET_PAYMENT_BASE_URL}auth/login`,
		method: 'POST',
		data: {
			email: "kmart_prod@k-link.co.id",
			password: "asdqwe123"
		},
		headers: {
			'Content-Type': 'application/json'
		},
	})
	return login
}

function getAdmin (models) {
  return async (req, res, next) => {
		let { page = 1, limit = 20, sort = '', keyword } = req.query
    let where = {}
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			const whereKey = keyword ? {
				[Op.or]: [
					{ nama : { [Op.like]: `%${keyword}%` }},
					{ username : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			const mappingSortField = [
				'nama',
				['namaRole', sequelize.literal('`RoleAdmin.namaRole`')],
				'statusAdmin',
			]
			const orders = buildOrderQuery(sort, mappingSortField)
			
			if(orders.length === 0){
				orders.push(['createdAt', 'DESC'])
			}

			where = whereKey;

      const { count, rows: dataAdmin } = await models.Admin.findAndCountAll({
				where,
				// attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'createdAt', 'updatedAt', 'deletedAt'] },
				include: [
					{ 
						model: models.RoleAdmin,
						attributes: ['namaRole'],
						where: { statusRole: true }
					},
				],
				order: orders,
				limit: parseInt(limit),
				offset: OFFSET,
			});

			// return OK(res, dataAdmin)
			const getResult = await Promise.all(dataAdmin.map(async val => {
				return await _buildResponseAdmin(val)
			}))

			const responseData = buildMysqlResponseWithPagination(
				getResult,
				{ limit, page, total: count }
			)

			return OK(res, responseData);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getAdminbyUid (models) {
  return async (req, res, next) => {
		let { uid } = req.params
    try {
      const dataAdmin = await models.Admin.findOne({
				where: { idAdmin: uid },
				attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'createdAt', 'updatedAt', 'deletedAt'] },
				include: [
					{ 
						model: models.RoleAdmin,
						attributes: ['namaRole'],
						where: { statusRole: true }
					},
				],
			});

			return OK(res, await _buildResponseAdmin(dataAdmin))
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function postAdmin (models) {
  return async (req, res, next) => {
		let body = req.body
		let where = {}
    try {
			const { userID } = req.JWTDecoded
			let salt, hashPassword, kirimdataUser;
			if(body.jenis == 'ADD'){
				where = { 
					statusAdmin: true,
					username: body.username,
				}
				const count = await models.Admin.count({where});
				if(count) return NOT_FOUND(res, 'data sudah di gunakan !')
				// const ksuid = await createKSUID()
				salt = await bcrypt.genSalt();
				hashPassword = await bcrypt.hash(body.password, salt);
				kirimdataUser = {
					idAdmin: body.idAdmin,
					consumerType: body.consumerType,
					nama: body.nama,
					username: body.username,
					password: hashPassword,
					kataSandi: encrypt(body.password),
					statusAdmin: 1,
					createBy: userID,
				}
				await models.Admin.create(kirimdataUser)
			}else if(body.jenis == 'EDIT'){
				if(await models.Admin.findOne({where: {username: body.username, [Op.not]: [{idAdmin: body.idAdmin}]}})) return NOT_FOUND(res, 'Username sudah di gunakan !')
				const data = await models.Admin.findOne({where: {idAdmin: body.idAdmin}});
				salt = await bcrypt.genSalt();
				let decryptPass = data.kataSandi != body.password ? body.password : decrypt(body.password)
				hashPassword = await bcrypt.hash(decryptPass, salt);
				kirimdataUser = {
					consumerType: body.consumerType,
					nama: body.nama,
					username: body.username,
					password: hashPassword,
					kataSandi: data.kataSandi == body.password ? body.password : encrypt(body.password),
					statusAdmin: 1,
					updateBy: userID,
				}
				await models.Admin.update(kirimdataUser, { where: { idAdmin: body.idAdmin } })
			}else if(body.jenis == 'DELETESOFT'){
				kirimdataUser = {
					statusAdmin: 0,
					deleteBy: userID,
					deletedAt: new Date(),
				}
				await models.Admin.update(kirimdataUser, { where: { idAdmin: body.idAdmin } })	
			}else if(body.jenis == 'DELETEHARD'){
				await models.Admin.destroy({ where: { idAdmin: body.idAdmin } });
			}else if(body.jenis == 'STATUSRECORD'){
				kirimdataUser = { 
					statusAdmin: body.kondisi, 
					updateBy: userID
				}
				await models.Admin.update(kirimdataUser, { where: { idAdmin: body.idAdmin } })
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getDataOrder () {
  return async (req, res, next) => {
		let { page, limit, inv, status } = req.query
		let url;
		try {
			if(inv){
				const data = _.split(inv, 'INV').reverse()
				const drop = _.dropRight(data)
				const hasil = drop.map(val => {
					let kumpul = `INV${val}`
					return kumpul
				})
				url = `${_.join(hasil, ',')}`
			}
			let response = await orderSvc.getDataOrder({page, limit, inv: url, status})
			
			return OK(res, { data: response.records, pageSummary: response.pageSummary });
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}  
}

function getOrderSummaryByProduct () {
	return async (req, res, next) => {
		let { startdate, enddate, payment, shippingType, statusfinal, jenis } = req.query
		let { idProductSync } = req.body
		let dateRange;
		try {
			if(startdate && enddate){
				dateRange = `${startdate},${enddate}`
			}
			const response = await orderSvc.getDataOrderSummaryByProduct({ dateRange, payment, shippingType, statusfinal, jenis }, idProductSync)
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function getProductVariant () {
	return async (req, res, next) => {
		let { kondisi, textInput } = req.body
		try {
			let inv;
			if(kondisi === 2){
				const data = _.split(textInput, 'INV').reverse()
				const drop = _.dropRight(data)
				const hasil = drop.map(val => {
					let kumpul = `INV${val}`
					return kumpul
				})
				inv = hasil
			}
			const response = await orderSvc.getDataProductVariant({ pilihan: kondisi, textInput: kondisi === 2 ? inv : textInput.split(',') })
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function getLeaderOrderByProduct () {
	return async (req, res, next) => {
		let { startdate, enddate, payment, shippingType, statusfinal } = req.query
		let { idProductSync } = req.body
		let dateRange;
		try {
			if(startdate && enddate){
				dateRange = `${startdate},${enddate}`
			}
			const response = await orderSvc.getLeaderOrderByProduct({ dateRange, payment, shippingType, statusfinal }, idProductSync)
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function getDetailOrderLeader () {
	return async (req, res, next) => {
		let { startdate, enddate, payment, shippingType, statusfinal } = req.query
		let { idUser } = req.params
		let { idProductSync } = req.body
		let dateRange;
		try {
			if(startdate && enddate){
				dateRange = `${startdate},${enddate}`
			}
			const response = await orderSvc.getDetailOrderByProduct({ dateRange, payment, shippingType, statusfinal }, idProductSync, idUser)
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function getConsumer () {
	return async (req, res, next) => {
		let { startdate, enddate, isConsumer, keyword, last, limit } = req.query
		let dateRange;
		try {
			if(startdate && enddate){
				dateRange = `${startdate},${enddate}`
			}
			const response = await orderSvc.getDataConsumer({ dateRange, isConsumer, keyword, last, limit })
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function getSurveiDNM () {
	return async (req, res, next) => {
		let { startdate, enddate, rating, keyword, page, limit, sort } = req.query
		let dateRange;
		try {
			if(startdate && enddate){
				dateRange = `${startdate},${enddate}`
			}
			const response = await orderSvc.getSurveiDNM({ dateRange, rating, keyword, page, limit, sort })
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function getDataWHStk () {
	return async (req, res, next) => {
		let { type, limit = 200, keyword, status } = req.query
		try {
			const response = await orderSvc.getDataWHSTK({ type, limit, keyword, status })
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function getRegistInApps () {
	return async (req, res, next) => {
		let { startDate, endDate, consumerType, keyword, last, limit } = req.query
		try {
			const response = await orderSvc.getDataRegisterInApps({ startDate, endDate, consumerType, keyword, last, limit })
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function checkMemberDetailKNET () {
	return async (req, res, next) => {
		let { idMember } = req.params
		try {
				const login = await loginKnet()
				const { data: response } = await request({
					url: `${KNET_BASE_URL}v.1/getMember`,
					method: 'POST',
					data: {
						dfno: idMember
					},
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${login.token}`,
					},
				})
			return OK(res, response.data);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function checkPayment () {
	return async (req, res, next) => {
		let { inv } = req.query
		try {
				const login = await loginPayment()
				const { data: response } = await request({
					url: `${KNET_PAYMENT_BASE_URL}api/payment_status`,
					method: 'POST',
					data: {
						order_id: inv
					},
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `${login.Authorization}`,
					},
				})
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function hitUpdateStatus () {
	return async (req, res, next) => {
		let { status, remarks } = req.query
		let { idOrder } = req.body
		try {
			let response = await orderSvc.hitUpdateStatus({status, remarks}, idOrder)
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function hitOrderManual () {
	return async (req, res, next) => {
		let { inv } = req.query
		try {
			let response = await orderSvc.hitOrderManual(inv)
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function hitCODConfirm () {
	return async (req, res, next) => {
		let { inv } = req.query
		try {
			let response = await orderSvc.hitCODConfirm(inv)
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function apiDataWHSTK () {
	return async (req, res, next) => {
		let { keyword } = req.query
		try {
			const build = item => {				
				return item.records.map(val => {
					return {
						locationCode: val.locationCode,
						fullname: val.fullname,
						address: val.address,
					}
				})
			}
			const whRes = await orderSvc.getDataWHSTK({ type: 'WAREHOUSE', keyword, limit: 200, status: 'ACTIVE' })
			const stkRes = await orderSvc.getDataWHSTK({ type: 'STOCKIST', keyword, limit: 200, status: 'ACTIVE' })
			const all = build(whRes).reduce((newArray, item) => {
				newArray.push(item);
				return newArray;
		 	}, build(stkRes));
			return OK(res, _.unionBy(all, 'locationCode'));
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function downloadDataWHSTK (models) {
	return async (req, res, next) => {
		try {
			const build = item => {				
				return item.records.map(val => {
					return {
						locationCode: val.locationCode,
						fullname: val.fullname,
						address: val.address,
					}
				})
			}
			const whRes = await orderSvc.getDataWHSTK({ type: 'WAREHOUSE', limit: 200, status: 'ACTIVE' })
			const stkRes = await orderSvc.getDataWHSTK({ type: 'STOCKIST', limit: 200, status: 'ACTIVE' })
			const all = build(whRes).reduce((newArray, item) => {
				newArray.push(item);
				return newArray;
		 	}, build(stkRes));


			ejs.renderFile(path.join(__dirname, "../../src/views/viewWarehouseStockist.ejs"), { dataWarehouseStockist: _.unionBy(all, 'locationCode') }, (err, data) => {
				if (err) {
					console.log(err);
				} else {
					// console.log(data)
					let options = {
						format: "A4",
						orientation: "portrait",
						quality: "10000",
						border: {
							top: "1cm",
							right: "1cm",
							bottom: "1cm",
							left: "1cm"
						},
						// header: {
						// 	height: "12mm",
						// },
						// footer: {
						// 	height: "15mm",
						// },
						httpHeaders: {
							"Content-type": "application/pdf",
						},
						type: "pdf",
					};
					pdf.create(data, options).toStream(function(err, stream){
						// const blob = new Blob([buffer], { type: 'application/pdf' });
						// const file = window.URL.createObjectURL(blob);
						// return window.open(file);
						return stream.pipe(res);
					});
				}
			});
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function testing (models) {
	return async (req, res, next) => {
		let { idProductPackage } = req.query
		try {
			const additionalNumber = Array(5-idProductPackage.toString().length)
      .fill(0).reduce((a, b) => a + b, '');
			return OK(res, additionalNumber);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

module.exports = {
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
}