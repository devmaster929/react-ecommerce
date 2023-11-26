const { hookable } = require('@evershop/evershop/src/lib/util/hookable');
const {
  getValueSync,
  getValue
} = require('@evershop/evershop/src/lib/util/registry');
const {
  startTransaction,
  commit,
  rollback,
  insert
} = require('@evershop/postgres-query-builder');
const {
  getConnection
} = require('@evershop/evershop/src/lib/postgres/connection');
const { getAjv } = require('../../../base/services/getAjv');
const couponDataSchema = require('./couponDataSchema.json');

function validateCouponDataBeforeInsert(data) {
  const ajv = getAjv();
  couponDataSchema.required = [
    'coupon',
    'status',
    'discount_amount',
    'discount_type'
  ];
  const jsonSchema = getValueSync(
    'createCouponDataJsonSchema',
    couponDataSchema
  );
  const validate = ajv.compile(jsonSchema);
  const valid = validate(data);
  if (valid) {
    return data;
  } else {
    throw new Error(validate.errors[0].message);
  }
}

async function insertCouponData(data, connection) {
  const coupon = await insert('coupon').given(data).execute(connection);
  return coupon;
}

/**
 * Create coupon service. This service will create a coupon with all related data
 * @param {Object} data
 * @param {Object} connection
 */
async function createCoupon(data, connection) {
  const couponData = await getValue('couponDataBeforeCreate', data);
  // Validate coupon data
  validateCouponDataBeforeInsert(couponData);

  // Insert coupon data
  const coupon = await hookable(insertCouponData, { connection })(
    couponData,
    connection
  );

  return coupon;
}

module.exports = async (data, context) => {
  const connection = await getConnection();
  await startTransaction(connection);
  try {
    const hookContext = {
      connection
    };
    // Make sure the context is either not provided or is an object
    if (context && typeof context !== 'object') {
      throw new Error('Context must be an object');
    }
    // Merge hook context with context
    Object.assign(hookContext, context);
    const coupon = await hookable(createCoupon, hookContext)(data, connection);
    await commit(connection);
    return coupon;
  } catch (e) {
    await rollback(connection);
    throw e;
  }
};
