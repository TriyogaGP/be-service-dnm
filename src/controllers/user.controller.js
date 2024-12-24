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
	bulanValues,
	paginate,
	buildMysqlResponseWithPagination,
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
const BASE_URL = process.env.BASE_URL
const KNET_BASE_URL = process.env.KNET_BASE_URL
const KNET_PAYMENT_BASE_URL = process.env.KNET_PAYMENT_BASE_URL
const KNET_SHIPPING_BASE_URL = process.env.KNET_SHIPPING_BASE_URL

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

async function loginShipping () {
	const { data: login } = await request({
		url: `${KNET_SHIPPING_BASE_URL}auth/token`,
		method: 'POST',
		data: {
			email: "mars@tes.com",
			password: "12345"
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

function getDataDashboardTransaksi (models) {
  return async (req, res, next) => {
		let { tahun } = req.query
    try {
      const dataTransaksi = await models.Transaksi.findAll({
				where: { tahun },
				order: [
					['idTransaksi', 'ASC'],
				]
			});

			return OK(res, dataTransaksi);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getDataDashboardTransaksiDaily (models) {
  return async (req, res, next) => {
		let { tahun, bulan } = req.query
    try {
      const dataTransaksiDaily = await models.TransaksiDaily.findOne({
				where: { tahun, bulan },
				order: [
					['idTransaksiDaily', 'ASC'],
				]
			});

			return OK(res, {
				tahun: dataTransaksiDaily.tahun,
				bulan: dataTransaksiDaily.bulan,
				dataJson: dataTransaksiDaily.dataJson ? JSON.parse([dataTransaksiDaily.dataJson]) : []
			});
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getDataDashboardShipping () {
  return async (req, res, next) => {
		try {
			let response = await orderSvc.getDataShippingType()
			return OK(res, response);
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}  
}

function getDataDashboardOrderCourier () {
  return async (req, res, next) => {
		try {
			let response = await orderSvc.getDataOrderCourier()
			return OK(res, response);
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}  
}

function getDataDashboardUserActive (models) {
  return async (req, res, next) => {
		let { userType, bulan } = req.query
    try {
      const dataUserActive = await models.UserActive.findAll({
				where: { userType, bulan },
				order: [
					['idUserActive', 'ASC'],
				]
			});

			let dataKumpul = []
			await dataUserActive.map(val => {
				let objectBaru = Object.assign(val.dataValues, {
					dataUser: val.dataValues.dataUser ? JSON.parse([val.dataValues.dataUser]) : []
				});
				return dataKumpul.push(objectBaru)
			})

			return OK(res, dataKumpul);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getDataDashboardProduct () {
  return async (req, res, next) => {
		let { kategori, is_package, condition, condition_value, detail = 0, page = 1, limit = 20, keyword } = req.query
		let url = {};
		try {
			if(kategori == 'ALL') {
				url = {data: kategori, isPackage: is_package, keyword}
			}
			if(kategori == 'PART') {
				url = {data: kategori, condition, conditionValue: condition_value, keyword}
			}
			let response = await orderSvc.getDataProduct(url)
			if(detail == 1){
				let totalPages = Math.ceil(response.length / Number(limit))
				return OK(res, {
					records: paginate(response, Number(limit), Number(page)),
					pageSummary: {
						page: Number(page),
						limit: Number(limit),
						total: response.length,
						totalPages,
					}
				});
			}
			return OK(res, response);
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}  
}

function getDataDashboardDetailUserActive () {
  return async (req, res, next) => {
		let { page = 1, limit = 20, isMember, detail, bulan } = req.query
    try {
      const mappingbulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
			let bulanNum = _.indexOf(mappingbulan, bulan) + 1
			bulanNum = bulanNum >= 10 ? bulanNum : "0"+bulanNum
			let tahun = new Date().getFullYear()
			let jumlah_hari = new Date(tahun, bulanNum, 0).getDate()
			const getBody = {
				dateFrom: dayjs(tahun+"-"+bulanNum+"-01").utc().format(),
				dateTo: dayjs(tahun+"-"+bulanNum+"-"+jumlah_hari).utc().format()
			}
			let response = await orderSvc.getDataUserActive({page, limit, dateRange: `${getBody.dateFrom},${getBody.dateTo}`, isMember, detail})
			const { records, pageSummary } = response

			return OK(res, { records, pageSummary });
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getDataDashboardDetailOrderUserActive () {
  return async (req, res, next) => {
		let { isMember, idUser, bulan } = req.query
    try {
      const mappingbulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
			let bulanNum = _.indexOf(mappingbulan, bulan) + 1
			bulanNum = bulanNum >= 10 ? bulanNum : "0"+bulanNum
			let tahun = new Date().getFullYear()
			let jumlah_hari = new Date(tahun, bulanNum, 0).getDate()
			const getBody = {
				dateFrom: dayjs(tahun+"-"+bulanNum+"-01").utc().format(),
				dateTo: dayjs(tahun+"-"+bulanNum+"-"+jumlah_hari).utc().format()
			}
			let response = await orderSvc.getDetailOrderUserActive({dateRange: `${getBody.dateFrom},${getBody.dateTo}`, isMember, idUser})
			return OK(res, response);
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
			if(err.response.data.data == 'errorSINGLE' || err.response.data.data == 'errorPACKAGE') return OK(res, err.response.data.data, err.response.data.message)
			return NOT_FOUND(res, err.response.data.message)
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
		let { type, limit = 200, keyword, status, last } = req.query
		try {
			const response = await orderSvc.getDataWHSTK({ type, last, limit, keyword, status })
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

function reloadDashboardTransaksi (models) {
	return async (req, res, next) => {
		let { tahun } = req.query
		try {
			const data = await models.Transaksi.findAll({
				where: { tahun },
				order: [
					['idTransaksi', 'ASC'],
				]
			});
			if(!data.length) {
				const payload = [
					{ tahun, bulan: 'Januari', dp: '0', bv: '0' },
					{ tahun, bulan: 'Februari', dp: '0', bv: '0' },
					{ tahun, bulan: 'Maret', dp: '0', bv: '0' },
					{ tahun, bulan: 'April', dp: '0', bv: '0' },
					{ tahun, bulan: 'Mei', dp: '0', bv: '0' },
					{ tahun, bulan: 'Juni', dp: '0', bv: '0' },
					{ tahun, bulan: 'Juli', dp: '0', bv: '0' },
					{ tahun, bulan: 'Agustus', dp: '0', bv: '0' },
					{ tahun, bulan: 'September', dp: '0', bv: '0' },
					{ tahun, bulan: 'Oktober', dp: '0', bv: '0' },
					{ tahun, bulan: 'November', dp: '0', bv: '0' },
					{ tahun, bulan: 'Desember', dp: '0', bv: '0' },
				]
				await models.Transaksi.bulkCreate(payload)
			}
			let hasil = []
			for(let i=1; i <= 12; i++) {
				let jumlah_hari = new Date(tahun, i, 0).getDate()
				let bulan = i >= 10 ? i : "0"+i
				const login = await loginKnet()
				const getBody = {
					dateFrom: tahun+"-"+bulan+"-01",
					dateTo: tahun+"-"+bulan+"-"+jumlah_hari
				}
				const { data: response } = await request({
					url: `${KNET_BASE_URL}v.1/getKMartData`,
					method: 'POST',
					data: getBody,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${login.token}`,
					},
				})

				if(response){
					let groupbyData = _.groupBy(response.resTransDetailPerDate, val => val.datetrans)

					let kumpul = await Promise.all(Object.entries(groupbyData).map(val => {
						let key = val[0]
						let data = val[1]
						let trx = []
						data.map(v => {
							trx.push({
								orderNumber: v.token,
								transaksi: {
									period: v.bonusmonth,
									date: v.datetrans,
									order_no: v.orderno,
									reff_no: v.token,
								},
								distributor: {
									code: v.id_memb,
									name: v.nmmember,
								},
								total: {
									dp: v.totPayDP,
									bv: v.total_bv,
								},
							})
						})
						return { key, trx }
					})) 

					let meta = {
						dp: 0,
						bv: 0,
					}
					let dataKumpulTransaksi = []
						kumpul.map(async vall => {
							dataKumpulTransaksi.push(...vall.trx)
							await Promise.all(vall.trx.map(val => {
								meta.dp += val.total.dp
								meta.bv += val.total.bv
							}))
						})

						const PATTERN = /INV-RS/
						const mappingTransaksi = dataKumpulTransaksi.filter(str => !PATTERN.test(str.orderNumber))
						
						let jml = {
							dp: 0,
							bv: 0,
						}

						let dataTransaksi = []
						await Promise.all(mappingTransaksi.map(async val => {
							jml.dp += val.total.dp
							jml.bv += val.total.bv
							dataTransaksi.push(val)
						}))

						hasil.push({
							bulan: bulanValues(tahun+"-"+i+"-01"),
							dataJumlah: jml
						})
				}
			}
			hasil.map(async val => {
				let kirimdata = { 
					tahun,
					bulan: val.bulan,
					dp: val.dataJumlah.dp,
					bv: val.dataJumlah.bv
					}
				await models.Transaksi.update(kirimdata, {where: { bulan: val.bulan, tahun }})
			})
			return OK(res, hasil);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function reloadDashboardTransaksiDaily (models) {
	return async (req, res, next) => {
		let { tahun, bulan } = req.query
		try {
			const mappingbulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
			let bulanNum = _.indexOf(mappingbulan, bulan) + 1
			let jumlah_hari = new Date(tahun, bulanNum, 0).getDate()
			let bln = bulanNum >= 10 ? bulanNum : "0"+bulanNum
			const data = await models.TransaksiDaily.findAll({
				where: { tahun, bulan },
				order: [
					['idTransaksiDaily', 'ASC'],
				]
			});
			if(!data.length) {
				const payload = { tahun, bulan, dataJson: null }
				await models.TransaksiDaily.create(payload)
			}

			const login = await loginKnet()
			const dataJson = []
			const getBody = {
				dateFrom: tahun+"-"+bln+"-01",
				dateTo: tahun+"-"+bln+"-"+jumlah_hari
			}
			const { data: response } = await request({
				url: `${KNET_BASE_URL}v.1/getKMartData`,
				method: 'POST',
				data: getBody,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${login.token}`,
				},
			})
			if(response){
				let groupbyData = _.groupBy(response.resTransDetailPerDate, val => val.datetrans)

				let kumpul = await Promise.all(Object.entries(groupbyData).map(val => {
					let key = val[0]
					let data = val[1]
					let trx = []
					data.map(v => {
						trx.push({
							orderNumber: v.token,
							transaksi: {
								period: v.bonusmonth,
								date: v.datetrans,
								order_no: v.orderno,
								reff_no: v.token,
							},
							distributor: {
								code: v.id_memb,
								name: v.nmmember,
							},
							total: {
								dp: v.totPayDP,
								bv: v.total_bv,
							},
						})
					})
					return { key, trx }
				})) 

				let meta = {
					dp: 0,
					bv: 0,
				}
				let dataKumpulTransaksi = []
				kumpul.map(async vall => {
					dataKumpulTransaksi.push(...vall.trx)
					await Promise.all(vall.trx.map(val => {
						meta.dp += val.total.dp
						meta.bv += val.total.bv
					}))
				})

				const PATTERN = /INV-RS/
				const mappingTransaksi = dataKumpulTransaksi.filter(str => !PATTERN.test(str.orderNumber))

				let result = _.chain(mappingTransaksi).groupBy("transaksi.date").toPairs().map(val => {
					return _.zipObject(['date', 'dataTrx'], val)
				}).value()

				let dataTransaksi = []
				await Promise.all(result.map(async val => {
					let jml = {
						dp: 0,
						bv: 0,
					}
					await Promise.all(val.dataTrx.map(vall => {
						jml.dp += vall.total.dp
						jml.bv += vall.total.bv
					}))
					dataTransaksi.push({
						total: {
							dp: jml.dp,
							bv: jml.bv
						},
						transaksi: {
							date: val.date,
							records: val.dataTrx.length
						}
					})
				}))

				let jml = {
					records: 0,
					dp: 0,
					bv: 0,
				}
				
				dataTransaksi.map(async val => {
					jml.records += val.transaksi.records
					jml.dp += val.total.dp
					jml.bv += val.total.bv
					dataJson.push({
						tanggal: new Date(val.transaksi.date).getDate(),
						record: val.transaksi.records,
						dp: val.total.dp,
						bv: val.total.bv,
					})
				});
			}

			await models.TransaksiDaily.update({ tahun, bulan, dataJson: JSON.stringify(dataJson)}, { where: { tahun, bulan } })
			return OK(res);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function reloadDashboardUserActive (models) {
	return async (req, res, next) => {
		let { isMember, detail, bulan } = req.query
		try {
			// let tahun = new Date().getFullYear()
			// let hasil = []
			// for(let i=1; i <= 12; i++) {
			// 	let jumlah_hari = new Date(tahun, i, 0).getDate()
			// 	let bulan = i >= 10 ? i : "0"+i
			// 	const getBody = {
			// 		dateFrom: dayjs(tahun+"-"+bulan+"-01").utc().format(),
			// 		dateTo: dayjs(tahun+"-"+bulan+"-"+jumlah_hari).utc().format()
			// 	}

			// 	let response = await orderSvc.getDataUserActive({dateRange: `${getBody.dateFrom},${getBody.dateTo}`, isMember, detail})
			// 	if(response){
			// 		hasil.push({
			// 			bulan: bulanValues(tahun+"-"+i+"-01"),
			// 			data: response.records
			// 		})
			// 	}
			// }

			// hasil.map(async val => {
			// 	let kirimdata = { 
			// 		userType: isMember == 0 ? 'Customer' : 'Member',
			// 		tahun,
			// 		bulan: val.bulan,
			// 		dataUser: JSON.stringify(val.data),
			// 		}
			// 	await models.UserActive.update(kirimdata, {where: { userType: isMember == 0 ? 'Customer' : 'Member', bulan: val.bulan }})
			// })

			const mappingbulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
			let bulanNum = _.indexOf(mappingbulan, bulan) + 1
			bulanNum = bulanNum >= 10 ? bulanNum : "0"+bulanNum
			let tahun = new Date().getFullYear()
			let jumlah_hari = new Date(tahun, bulanNum, 0).getDate()
			const getBody = {
				dateFrom: dayjs(tahun+"-"+bulanNum+"-01").utc().format(),
				dateTo: dayjs(tahun+"-"+bulanNum+"-"+jumlah_hari).utc().format()
			}

			let response = await orderSvc.getDataUserActive({dateRange: `${getBody.dateFrom},${getBody.dateTo}`, isMember, detail})
			let kirimdata = { 
				userType: isMember == 0 ? 'Customer' : 'Member',
				tahun,
				bulan,
				dataUser: JSON.stringify(response.records),
				}
			await models.UserActive.update(kirimdata, {where: { userType: isMember == 0 ? 'Customer' : 'Member', bulan }})
			return OK(res, response.records);
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

function checkShippingStatus () {
	return async (req, res, next) => {
		let { no_resi, ekspedisi } = req.query
		try {
			const login = await loginShipping()
			const { data: response } = await request({
				url: `${KNET_SHIPPING_BASE_URL}api/tracking/history`,
				method: 'POST',
				data: {
					awb: no_resi,
					ekspedisi,
				},
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${login.token}`,
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
			let response = await orderSvc.hitCODConfirmation(inv)
			return OK(res, response);
		} catch (err) {
			console.log(err);
			
			return NOT_FOUND(res, err.message)
		}
	}
}

function hitKeranjangOrder () {
	return async (req, res, next) => {
		let { view } = req.query
		try {
			let response = await orderSvc.hitKeranjangOrder({ view })
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
			const mappingbulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
			const bulan = mappingbulan[new Date().getMonth()]
			let bulanNum = _.indexOf(mappingbulan, bulan) + 1
			let tahun = new Date().getFullYear()
			let jumlah_hari = new Date(tahun, bulanNum, 0).getDate()
			return OK(res, { additionalNumber, bulan: bulanNum, jumlah_hari });
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

  apiDataWHSTK,
  downloadDataWHSTK,
  testing,
}