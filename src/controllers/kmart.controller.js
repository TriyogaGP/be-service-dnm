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
} = require('./helper.service')
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

async function getDataDNM (param) {
	const login = await loginKnet()
	const getBody = {
		dateFrom: param.startdate ? param.startdate : DateTime.local().plus({ day: -7 }).toISODate(),
		dateTo: param.enddate ? param.enddate : DateTime.local().toISODate()
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
	return response
}

function getTransaksiDetail () {
  return async (req, res, next) => {
		let { page = 1, limit = 20, startdate, enddate, sort = '' } = req.query
    try {
			const mappingSortField = [
				'date', 'reff_no', 'code', 'name', 'dp', 'bv'
			]
			const orders = buildOrderQuery(sort, mappingSortField)
			let response = await getDataDNM({startdate, enddate})
			if(response.status === 'success'){
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

				let dataKumpulTransaksi = []
				kumpul.map(async vall => {
					dataKumpulTransaksi.push(...vall.trx)
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
				
				if(orders.length) {
					let fieldName = [], orderSort = [] 
					Object.entries(orders).forEach(str => {
						if(str[1][0] == 'date' || str[1][0] == 'reff_no'){
							fieldName.push(`transaksi.${str[1][0]}`)
						}else if(str[1][0] == 'code' || str[1][0] == 'name'){
							fieldName.push(`distributor.${str[1][0]}`)
						}else if(str[1][0] == 'dp' || str[1][0] == 'bv'){
							fieldName.push(`total.${str[1][0]}`)
						}

						if(str[1][1] === 'ASC'){
							orderSort.push(`asc`)
						}else{
							orderSort.push(`desc`)
						}
					})

					let dataTampung = _.orderBy(dataTransaksi, fieldName, orderSort)
					let totalPages = Math.ceil(dataTampung.length / Number(limit))
					return OK(res, {
						records: paginate(dataTampung, Number(limit), Number(page)),
						pageSummary: {
							page: Number(page),
							limit: Number(limit),
							total: dataTampung.length,
							totalPages,
						},
						dataJumlah: jml
					});
					// return OK(res, { dataTransaksi: _.orderBy(dataTransaksi, fieldName, orderSort), dataJumlah: jml });
				}

				let dataTampung = _.orderBy(dataTransaksi, 'transaksi.date', 'asc')
				let totalPages = Math.ceil(dataTampung.length / Number(limit))
				return OK(res, {
					records: paginate(dataTampung, Number(limit), Number(page)),
					pageSummary: {
						page: Number(page),
						limit: Number(limit),
						total: dataTampung.length,
						totalPages,
					},
					dataJumlah: jml
				});
				// return OK(res, { dataTransaksi: _.orderBy(dataTransaksi, 'transaksi.date', 'asc'), dataJumlah: jml });
			}
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getTransaksiSummary () {
  return async (req, res, next) => {
		let { startdate, enddate, sort = '' } = req.query
    try {
			const mappingSortField = [
				'date', 'records', 'dp', 'bv'
			]
			const orders = buildOrderQuery(sort, mappingSortField)
			let response = await getDataDNM({startdate, enddate})
			if(response.status === 'success'){
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

				let dataKumpulTransaksi = []
				kumpul.map(async vall => {
					dataKumpulTransaksi.push(...vall.trx)
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
				});

				if(orders.length) {
					let fieldName = [], orderSort = [] 
					Object.entries(orders).forEach(str => {
						if(str[1][0] == 'date' || str[1][0] == 'records'){
							fieldName.push(`transaksi.${str[1][0]}`)
						}else if(str[1][0] == 'dp' || str[1][0] == 'bv'){
							fieldName.push(`total.${str[1][0]}`)
						}

						if(str[1][1] === 'ASC'){
							orderSort.push(`asc`)
						}else{
							orderSort.push(`desc`)
						}
					})
					return OK(res, { dataTransaksi: _.orderBy(dataTransaksi, fieldName, orderSort), dataJumlah: jml });
				}

				return OK(res, { dataTransaksi: _.orderBy(dataTransaksi, 'transaksi.date', 'asc'), dataJumlah: jml });
			}
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getSalesArea () {
	return async (req, res, next) => {
		let { startdate, enddate, jenisShipping } = req.query
		try {
			const getDate = {
				// dateFrom: startdate ? startdate : dayjs().add(-1, 'month').format('YYYY-MM-DD'),
				dateFrom: startdate ? startdate : '2021-04-10',
				dateTo: enddate ? enddate : dayjs().format('YYYY-MM-DD'),
			}
			let response = await orderSvc.getDataSalesArea({dateRange: `${getDate.dateFrom},${getDate.dateTo}`, jenisShipping})
			return OK(res, response);
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

function testing (models) {
	return async (req, res, next) => {
		let { startdate, enddate, jenisShipping } = req.query
		try {
			const getDate = {
				dateFrom: startdate ? startdate : dayjs().add(-1, 'month').format('YYYY-MM-DD'),
				dateTo: enddate ? enddate : dayjs().format('YYYY-MM-DD'),
			}
			let response = await orderSvc.getDataSalesArea({dateRange: `${getDate.dateFrom},${getDate.dateTo}`, jenisShipping})
			return OK(res, response);
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

module.exports = {
  getTransaksiDetail,
  getTransaksiSummary,
  getSalesArea,
  testing,
}