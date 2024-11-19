const { decrypt, convertDateTime, dateconvert, convertDate, uppercaseLetterFirst3 } = require('@triyogagp/backend-common/utils/helper.utils');
// const { } = require('../controllers/helper.service')
const dotenv = require('dotenv');
dotenv.config();
const BASE_URL = process.env.BASE_URL

async function _buildResponseUser(dataUser, refreshToken, accessToken) {
	return {
		idAdmin: dataUser.idAdmin,
		consumerType: dataUser.consumerType,
		namaRole: dataUser.RoleAdmin.namaRole,
		nama: uppercaseLetterFirst3(dataUser.nama),
		username: dataUser.username,
		password: dataUser.password,
		kataSandi: dataUser.kataSandi,
		statusAktif: dataUser.statusAktif,
		refreshToken,
		accessToken
	}
}

async function _buildResponseAdmin(dataUser) {
	return {
		idAdmin: dataUser.idAdmin,
		consumerType: dataUser.consumerType,
		namaRole: dataUser.RoleAdmin.namaRole,
		nama: uppercaseLetterFirst3(dataUser.nama),
		username: dataUser.username,
		password: dataUser.password,
		kataSandi: dataUser.kataSandi,
		statusAdmin: dataUser.statusAdmin,
		flag: dataUser.deleteBy !== null || dataUser.deletedAt !== null,
	}
}

module.exports = {
  _buildResponseUser,
  _buildResponseAdmin,
}