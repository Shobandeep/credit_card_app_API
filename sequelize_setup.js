const { Sequelize, DataTypes } = require('sequelize');
const { sqlParams } = require('./config');
const vendors = require('./res/vendors.js');

/*
  *********************************
  * ESTABLISH DATABASE CONNECTION *
  *********************************
*/
const sequelize = new Sequelize(sqlParams.database, sqlParams.user, sqlParams.password, {
  host: sqlParams.host,
  dialect: 'mysql',
  logging: false
});


/*
  *****************
  * DEFINE MODELS *
  *****************
*/
const Customer = sequelize.define('customer', {
  customerId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate : {
      isAlpha: true // will only allow letters
    }
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate : {
      isAlpha: true // will only allow letters
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate : {
      isEmail: true // checks for email format (foo@bar.com)
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: 1
  }
}, {freezeTableName: true});

const CreditCard = sequelize.define('creditcard', {
  creditCardNumber: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  creditLimit: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false
  },
  creditBalance: {
    type: DataTypes.DECIMAL(8, 2),
    defaultValue: 0
  }
}, {freezeTableName: true});

const CreditCardTransaction = sequelize.define('creditcardtransaction', {
  transactionId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  creditCardNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  total: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false
  }
}, {freezeTableName: true});

const TransactionDetails = sequelize.define('transactiondetails', {
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {freezeTableName: true})

const Vendor = sequelize.define('vendor', {
  vendorId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  vendorName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  vendorDescription: {
    type: DataTypes.STRING(300),
    allowNull: false
  }
}, {freezeTableName: true});

const VendorItem = sequelize.define('vendoritem', {
  itemId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  vendorId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  itemName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  itemDescription: {
    type: DataTypes.STRING(300),
    allowNull: false
  },
  imgLink: {
    type: DataTypes.STRING,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false
  }
}, {freezeTableName: true});

/*
  *********************************
  * ADD CONTRAINTS / ASSOCIATIONS *
  *********************************
*/

// a customer has one or more credit cards
Customer.hasMany(CreditCard, {
  foreignKey: 'customerId'
});
CreditCard.belongsTo(Customer, {
  foreignKey: 'customerId'
});

// a credit card has one or more transactions
CreditCard.hasMany(CreditCardTransaction, {
  foreignKey: 'creditCardNumber'
});
CreditCardTransaction.belongsTo(CreditCard, {
  foreignKey: 'creditCardNumber'
});

// every transaction detail references a vendor item
Vendor.hasMany(VendorItem, {
  foreignKey: 'vendorId'
});
VendorItem.belongsTo(Vendor, {
  foreignKey: 'vendorId'
});

// TransactionDetails is a junction table of CreditCardTransaction and VendorItem
CreditCardTransaction.belongsToMany(VendorItem, {
  through: TransactionDetails,
  foreignKey: 'transactionId',
  allowNull: false
});
VendorItem.belongsToMany(CreditCardTransaction, {
  through: TransactionDetails,
  foreignKey: 'itemId',
  allowNull: false
});
TransactionDetails.belongsTo(CreditCardTransaction, {
  foreignKey: 'transactionId',
  allowNull: false
});
TransactionDetails.belongsTo(VendorItem, {
  foreignKey: 'itemId',
  allowNull: false
});

// pass in {force:true} to reset the database
sequelize.sync().then(() => {
  // make all credit cards start at 1000
  sequelize.query("ALTER TABLE creditcard AUTO_INCREMENT = 1000");

  // payment is a special vendor for handling credit card payments
  Vendor.findOrCreate(  {
    defaults : {
      vendorName: 'payment',
      vendorDescription: 'N/A'
    },
    where: {
      vendorId: 1,
    }
  });

  // add all the other vendors
  for(let i = 0; i < vendors.length; i++) {
    Vendor.findOrCreate({
      defaults : {
        vendorName: vendors[i].vendorName,
        vendorDescription: vendors[i].vendorDesc
      },
      where: {
        vendorId: vendors[i].id
      }
    });
  }

  // add all items sold by vendors
  for(let i = 0; i < vendors.length; i++) {
    let items = vendors[i].items;
    for(let j = 0; j < items.length; j++) {
      VendorItem.findOrCreate({
        defaults : {
          vendorId: vendors[i].id,
          itemName: items[j].name,
          itemDescription: items[j].description,
          imgLink: items[j].imgLink,
          price: items[j].price
        },
        where: {
          itemId: items[j].itemId
        }
      });
    }
  }

});





/*
  *********************
  * EXPORT EVERYTHING *
  *********************
*/
exports.sequelize = sequelize;
exports.Customer = Customer;
exports.CreditCard = CreditCard;
exports.CreditCardTransaction = CreditCardTransaction;
exports.TransactionDetails = TransactionDetails;
exports.Vendor = Vendor;
exports.VendorItem = VendorItem;