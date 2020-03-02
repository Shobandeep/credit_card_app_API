/*
  ***********
  * IMPORTS *
  ***********
*/
const Express = require('express');
const Bcrypt = require('bcrypt');
const JWT = require('jsonwebtoken');
const { Op } = require('sequelize');
const Cors = require('cors');
// config file will hold MySQL params, JWT seceret, and the hasded admin password
const { jwtSecret, adminAuthKey, hashedAdminPassword } = require('./config');
// database is already created and initialized in sequelize_setup.js
const { 
  sequelize, 
  Customer, 
  CreditCard, 
  CreditCardTransaction, 
  TransactionDetails, 
  Vendor, 
  VendorItem 
} = require('./sequelize_setup');


/*
  ***********
  * EXPRESS *
  ***********
*/
let app = Express();
const PORT = 5000;
app.use(Express.static(__dirname + '/res'));
app.use(Express.urlencoded({extended: true}));
app.use(Express.json());  

let corsOptions = {
  origin: 'http://localhost:4200',
  optionsSuccessStatus: 200 
};

app.listen(PORT, () => {
  console.log(`server started, listen on port ${PORT}`);
});


/*
  *****************
  * VENDOR ROUTES *
  *****************
*/

app.get('/vendors', Cors(corsOptions), (req, res) => {
  Vendor.findAll({
    where: {
      vendorId: {
        [Op.gt]: 1
      }
    }
  }).then(results => {
    let vendors = results.map(vendor => {
      return {
        name: vendor.vendorName,
        description: vendor.vendorDescription 
      };
    });
    res.send(vendors);
  });  
});

app.get('/vendoritems/:name', Cors(corsOptions), async (req, res) => {
  let name = req.params.name;
  let vendor = await Vendor.findAll({
    where : {
      vendorName: name
    }
  });
  if(vendor.length == 1) {
    let items =  await VendorItem.findAll({
      where : {
        vendorId: vendor[0].vendorId
      }
    });
    items = items.map(item => item = {
      itemId: item.itemId,
      vendorId: item.vendorId,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      imgLink: item.imgLink,
      price: item.price
    });
    res.send(items);
  }
  else {
    res.json( {error: true} );
  }
});

/*
  ***************
  * USER ROUTES *
  ***************
*/

const emailRegex = RegExp("[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$");
const nameRegex = RegExp("^[a-zA-Z]+$");
const saltRounds = 10;

app.options('/register', Cors(corsOptions))
app.post('/register', Cors(corsOptions), async (req, res) => {
  let user = req.body;

  // validate email and password
  if(!emailRegex.test(user.email) || user.password.length < 6 || user.password.length > 16) {
    res.json({ error: 'EMAIL/PASSWORD NOT VALID' });
    return;
  }

  // validate first and last name
  if(
    user.firstName.length < 3 
    || user.lastName.length < 3 
    || !nameRegex.test(user.firstName) 
    || !nameRegex.test(user.lastName)
    ) {
    res.json({ error: 'FIRST/LAST NAME NOT VALID' });
    return;
  }
  

  // check if there is already a user with that email in the database
  let result = await Customer.findAll(  {
    where: {
      email: user.email
    }
  });

  // if there was, stop here
  if(result.length == 1) {
    res.json({error: 'email already in use'});
  }
  else {
    // new user, register them, but first hash the password and fix names
    user.firstName = user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1).toLowerCase();
    user.lastName = user.lastName.charAt(0).toUpperCase() + user.lastName.slice(1).toLowerCase();
    user.password = await Bcrypt.hash(user.password, saltRounds);
    try {
      let newUser = await Customer.create(user);
      let token = JWT.sign(user.email, jwtSecret.secret)
      res.json({ 
        firstName: user.firstName,
        lastName: user.lastName,
        authToken: token
      });
      
    } catch (error) {
      res.json({error: 'server error: could not create user'});
    }
  }
});

app.options('/login', Cors(corsOptions))
app.post('/login', Cors(corsOptions), async (req, res) => {
  let user = req.body;

  // validate email and password
  if(!emailRegex.test(user.email) || user.password.length < 6 || user.password.length > 16) {
    res.json({ error: 'email/password is not valid' });
    return;
  }
  // check for user in database
  let customer = await Customer.findAll({
    where: {
      email: user.email
    }
  });

  // if no such user
  if(customer.length == 0) {
    res.json({ error: 'email not found' });
    return;
  }

  let isMatching = await Bcrypt.compare(user.password, customer[0].password);
  if(!isMatching) {
    res.json({ error: 'password was incorrect' });
    return
  }
  // make sure user is active
  else if(customer[0].isActive == 0) {
    res.json({ error: 'user account has deactivated, contact admin' });
    return
  }
  // passwords match, we found the user
  else {
    // generate a JWT token to verify login for future requests
    let token = JWT.sign(customer[0].email, jwtSecret.secret)

    res.json({ 
      firstName: customer[0].firstName,
      lastName: customer[0].lastName,
      authToken: token
    });
  }
});

app.options('/auth', Cors(corsOptions))
app.post('/auth', Cors(corsOptions), async (req, res) => {
  let user = req.body;
  let auth = await authenticate(user);
  if(auth.success)
    res.json({ authorized: true });
  else 
    res.json({ authorized: false });
});

app.options('/apply_for_card', Cors(corsOptions))
app.post('/apply_for_card', Cors(corsOptions), async (req, res) => {
  let user = req.body;
  let auth = await authenticate(user);
  if(auth.error) {
    res.json(auth);
    return;
  }
  try {
    let customer = await Customer.findAll({
      where: {
        email: auth.email
      }
    });

    // the credit limit is going to be some multiple of 100 between 500 and 2500
    let cardLimit = Math.round((Math.random() * 20) + 5) * 100;
    let card = await CreditCard.create({
      customerId: customer[0].customerId,
      creditLimit: cardLimit
    })
    res.json({success: true});

  } catch (err) {
    res.json({error: true});
  }

});

// gets a list of all the user's cards
app.options('/cards', Cors(corsOptions))
app.post('/cards', Cors(corsOptions), async (req, res) => { 
  let user = req.body;
  let auth = await authenticate(user);
  if(auth.error) {
    res.json(auth);
    return;
  }
  res.json(await getCards(auth.customerId));
});

// gets a list of all transactions made by this card
app.options('/card_transactions', Cors(corsOptions))
app.post('/card_transactions', Cors(corsOptions), async (req, res) => {
  let user = req.body;
  let auth = await authenticate(user);
  if(auth.error) {
    res.json(auth);
    return;
  }

  res.json(await getCardTransactions(auth.customerId, user.card.creditCardNumber));
});

// gets a list of all transactions made by this card
app.options('/transaction_details', Cors(corsOptions))
app.post('/transaction_details', Cors(corsOptions), async (req, res) => {
  let user = req.body;
  let auth = await authenticate(user);
  if(auth.error) {
    res.json(auth);
    return;
  }

  res.json(await getTransactionDetails(auth.customerId, user.card.creditCardNumber, user.transactionId));
});

// process an order
app.options('/transaction', Cors(corsOptions))
app.post('/transaction', Cors(corsOptions), async (req, res) => {
  let user = req.body.user;
  let items = req.body.items;
  let cardNumber = req.body.cardNumber;
  let auth = await authenticate(user);
  if(auth.error) {
    res.json(auth);
    return;
  }

  try {

    let customer = await Customer.findAll({
      where: {
        email: auth.email
      }
    });
    let cards = await CreditCard.findAll({
      where: {
        customerId: customer[0].customerId
      }
    });
    // verify that the card we were passed exits / belongs to this user
    let card = cards.filter(creditCard => creditCard.creditCardNumber === cardNumber);
    if(!card)
      throw {
        myError: true,
        errorMsg: 'credit card not found'
      }; 
    

    // find all items to buy in database
    let itemIds = items.map( item => item = {itemId: item.itemId} );
    let itemsToBuy = await VendorItem.findAll({
      where: {
        [Op.or]: itemIds
      }
    });

    // validate the quantity, it should be between 1 and 10
    let quantityIsValid = items.every( item => (item.quantity > 0 && item.quantity < 11));

    if(
      itemsToBuy.length == 0               // couldn't find items
      || itemsToBuy.length != items.length // couldn't find all of the items
      || !quantityIsValid                  // quantity wasn't in the allowed range
    ) throw {
        myError: true,
        errorMsg: 'items are not valid'
      };

    let orderTotal = 0;
    itemsToBuy.forEach(itemToBuy => {
      let item = items.find( item => (item.itemId == itemToBuy.itemId));
      orderTotal += item.quantity * itemToBuy.price;
    });

    // lastly we check if the card has enough money for the transaction
    if(orderTotal < (card.creditLimit - card.creditBalance))
      throw {
        myError: true,
        errorMsg: 'insufficient balance'
      };
      
    // do a transaction, roll back if we get a problem at any step
    await sequelize.transaction(async (trans) => {
      let newBalance = parseFloat(card[0].creditBalance) + orderTotal;
      // add the balance to the card that will be paying for the order
      await CreditCard.update(
        { creditBalance: newBalance },
        { 
          where: {
            creditCardNumber: card[0].creditCardNumber 
          }
        },
        { transaction: trans }
      );

      // create a transaction for order
      let transaction = await CreditCardTransaction.create({
        creditCardNumber: card[0].creditCardNumber,
        total: orderTotal 
      }, { transaction: trans });

      // link each item and it's quantity to the transaction id we just made
      for(let i = 0; i < items.length; i++) {
        await TransactionDetails.create({
          transactionId: transaction.transactionId,
          itemId: items[i].itemId,
          quantity: items[i].quantity
        }, { transaction: trans });
      }
    });
    res.json({success: true});
    
  } catch (err) {
    // if I generated the error, send it back. Otherwise let
    // the front end know that 'something' went wrong
    if(err.myError)
      res.json({
        error: true,
        msg: err.errorMsg
      });
    else
      res.json({error: true});
  }
});

// make a payment
app.options('/payment', Cors(corsOptions))
app.post('/payment', Cors(corsOptions), async (req, res) => {
  let cardNumber = req.body.cardNumber;
  let amount = parseFloat(req.body.amount.toFixed(2));
  try {

    let card = await CreditCard.findAll({
      where: {
        creditCardNumber: cardNumber
      }
    });

    // card not found
    if(card.length == 0)
      throw {
        myError: true,
        errorMsg: 'card not found, check your input'
        };
    // no payment needed  
    if(parseFloat(card[0].creditBalance) <= 0) 
      throw {
      myError: true,
      errorMsg: 'no payment is required'
      };
    
    if(
      // make sure amount is a number
      !amount     
      // make sure amount is with the allowable range
      || (amount >  2500 || amount < 0.01) 
      // don't let customer pay more than the limit in a single payment, it's okay to have a negative balance                               
      || amount > parseFloat(card[0].creditLimit) 
    ) throw {
      myError: true,
      errorMsg: 'payment amount is not valid, you cannot pay more than the credit limit'
      };

    // process the payment, if any step fails, rollback
    await sequelize.transaction(async (trans) => {
      let newBalance = parseFloat(card[0].creditBalance) - amount;
      // update the credit card
      await CreditCard.update(
        { creditBalance: newBalance },
        { 
          where: {
            creditCardNumber: card[0].creditCardNumber 
          }
        },
        { transaction: trans }
      );
      // note the transaction
      await CreditCardTransaction.create({
        creditCardNumber: card[0].creditCardNumber,
        total: -amount
      });
    });

    res.json({success: true});
    
  } catch (err) {
    // if I generated the error, send it back. Otherwise let
    // the front end know that 'something' went wrong
    if(err.myError)
      res.json({
        error: true,
        msg: err.errorMsg
      });
    else
      res.json({error: true});
  }
});

/*
  ****************
  * ADMIN ROUTES *
  ****************
*/
app.options('/admin_login', Cors(corsOptions))
app.post('/admin_login', Cors(corsOptions), async (req, res) => {
  let admin = req.body;

  // validate the password
  let isMatching = await Bcrypt.compare(admin.password, hashedAdminPassword);
  if(!isMatching) {
    res.json({ error: 'password was incorrect' });
  }
  // passwords match, sign
  else {
    // generate a JWT token to verify login for future requests
    let token = JWT.sign(adminAuthKey, jwtSecret.secret)
    res.json({ authToken: token });
  }
});

app.options('/admin_auth', Cors(corsOptions))
app.post('/admin_auth', Cors(corsOptions), async (req, res) => {
  let admin = req.body;
  let auth = authenticateAdmin(admin);

  if(auth.error) res.json( {authorized: false} );
  else res.json( {authorized: true} );
});

app.options('/admin_vendor_transactions/:name', Cors(corsOptions))
app.post('/admin_vendor_transactions/:name', Cors(corsOptions), async (req, res) => {
  let name = req.params.name;
  let admin = req.body;
  let auth = authenticateAdmin(admin);
  if(auth.error) {
    res.json(auth);
    return;
  }

  try {
    let vendor = await Vendor.findAll({
      where: {
        vendorName: name
      }
    });
  
    if(vendor.length == 0)
      throw 'vendor not found'

    let transactions = await TransactionDetails.findAll({
      include: [{
        model: VendorItem,
        attributes: [],
        where: {
          vendorId: vendor[0].vendorId
        }
      },
      {
        model: CreditCardTransaction,
        attributes: ['total'],
        include: [{ 
          model: CreditCard,
          attributes: ['creditCardNumber'],
          include: [{
            model: Customer,
            attributes: ['firstName', 'lastName', 'customerId']
          }]
        }]
      }]
    });
  
    transactions = transactions.map(trans => {
      return {
        amount: trans.creditcardtransaction.total,
        transactionId: trans.transactionId,
        date: new Date(trans.createdAt).toUTCString(),
        firstName: trans.creditcardtransaction.creditcard.customer.firstName,
        lastName: trans.creditcardtransaction.creditcard.customer.lastName,
        customerId: trans.creditcardtransaction.creditcard.customer.customerId,
        cardNumber: trans.creditcardtransaction.creditcard.creditCardNumber
      }
    });


    res.json(transactions)

  } catch(err) {
    res.json({ error: true })
  }
});

app.options('/admin_vendor_transaction_details', Cors(corsOptions))
app.post('/admin_vendor_transaction_details', Cors(corsOptions), async (req, res) => {
  let admin = req.body;
  let auth = authenticateAdmin(admin);
  if(auth.error) {
    res.json(auth);
    return;
  }
  let details = admin.vendorTransactionDetails;
  res.json(await getTransactionDetails(details.customerId, details.cardNumber, details.transactionId));
});

app.options('/admin_client_list', Cors(corsOptions))
app.post('/admin_client_list', Cors(corsOptions), async (req, res) => {
  let admin = req.body;
  let auth = authenticateAdmin(admin);
  if(auth.error) {
    res.json(auth);
    return;
  }
  try {
    let customers = await Customer.findAll({
      attributes: ['customerId', 'isActive', 'firstName', 'lastName']
    });
    res.json(customers);

  } catch (err) {
    res.json({ error: true });
  }
});

app.options('/admin_client_cards', Cors(corsOptions))
app.post('/admin_client_cards', Cors(corsOptions), async (req, res) => {
  let admin = req.body;
  let auth = authenticateAdmin(admin);
  if(auth.error) {
    res.json(auth);
    return;
  }
  res.json(await getCards(admin.currentClient.customerId));
});

app.options('/admin_set_active', Cors(corsOptions))
app.post('/admin_set_active', Cors(corsOptions), async (req, res) => {
  let admin = req.body;
  let auth = authenticateAdmin(admin);
  if(auth.error) {
    res.json(auth);
    return;
  }
  try {
    let customer = await Customer.findAll({
      attributes: ['customerId', 'isActive', 'firstName', 'lastName'],
      where: {
        customerId: admin.currentClient.customerId
      }
    });
    if(customer.length == 0)
      throw 'no such customer'

    customer[0].isActive = (customer[0].isActive) ? 0 : 1;
    customer[0].save();
    res.json(customer[0])

  } catch (err) {
    res.json({ error: true }); 
  }
});

// gets a list of all transactions made by this card
app.options('/admin_card_transactions', Cors(corsOptions))
app.post('/admin_card_transactions', Cors(corsOptions), async (req, res) => {
  let admin = req.body;
  let client = admin.currentClient;
  let auth = authenticateAdmin(admin);
  if(auth.error) {
    res.json(auth);
    return;
  }

  res.json(await getCardTransactions(client.customerId, admin.card.creditCardNumber));
});

// gets a list of all transactions made by this card
app.options('/admin_transaction_details', Cors(corsOptions))
app.post('/admin_transaction_details', Cors(corsOptions), async (req, res) => {
  let admin = req.body;
  let client = admin.currentClient;
  let auth = authenticateAdmin(admin);
  if(auth.error) {
    res.json(auth);
    return;
  }

  res.json(await getTransactionDetails(client.customerId, admin.card.creditCardNumber, admin.transactionId));
});

/*
  ********************
  * HELPER FUNCTIONS *
  ********************
*/

// verify user and extract email from JWT
async function authenticate(user) {
  try {
    let email = JWT.verify(user.authToken, jwtSecret.secret);
    let customer = await Customer.findAll({
      where: {
        email: email
      }
    });

    // verify customer exists
    if(customer.length == 0 )
      return {
        error: true,
        errorMsg: 'user does not exist'
      };
    // verify email 
    else if(customer[0].email !== email)
      return {
        error: true,
        errorMsg: 'token is invalid'
      };
    // verify customer account is active
    else if(customer[0].isActive == 0)
      return {
        error: true,
        errorMsg: 'user account is deactivated'
      };
    else
      return { 
        success: true,
        email: customer[0].email,
        customerId: customer[0].customerId
      };
    
  } catch (err) {
    // if JWT throws an error, token is invalid
    return {
      error: true,
      errorMsg: 'token is invalid'
    };
  }
}

// verify an admin JWT
function authenticateAdmin(admin) {
  try {
    let adminAuth = JWT.verify(admin.authToken, jwtSecret.secret);
    if(adminAuth !== adminAuthKey)
      throw 'not admin'
    return { authorized: true};
  } catch (err) {
    return { error: true };
  }

}

// returns all the cards of a given user (by email)
async function getCards(customerId) {
  try {
    let cards = await CreditCard.findAll({
      where: {
        customerId: customerId
      }
    })

    cards = cards.map(card => { 
      return {
        creditCardNumber: card.creditCardNumber,
        creditLimit: card.creditLimit,
        creditBalance: card.creditBalance
        };
    });
    return cards;

  } catch (err) {
    return { error: true };
  }

}

// returns all transactions by a card number
async function getCardTransactions(customerId, cardNumber) {
  try {
    // verify that the card does indeed belong to this user
    let creditCard = await CreditCard.findAll({
      where: {
        creditCardNumber: cardNumber
      }
    });
    if(
      // couldn't find the card
      creditCard.length == 0     
      // the card does not belong to this user                     
      || creditCard[0].customerId !== customerId      
    ) throw 'card verification error'

    // get all transactions that belong to this card 
    let transactions = await CreditCardTransaction.findAll({
      where: {
        creditCardNumber: creditCard[0].creditCardNumber
      }
    });

    transactions = transactions.map(transaction => {
      return {
        amount: transaction.total,
        date: new Date(transaction.createdAt).toUTCString(),
        transactionId: transaction.transactionId
      }
    });

    return transactions;

  } catch (err) {
    return { error: true };
  }

}

// get the order summary of a particular transaction
async function getTransactionDetails(customerId, cardNumber, transactionId) {
  try {
    // verify that the card exists and does indeed belong to this user
    let creditCard = await CreditCard.findAll({
      where: {
        creditCardNumber: cardNumber
      }
    });
    if(
      // couldn't find the card
      creditCard.length == 0
      // the card does not belong to this user
      || creditCard[0].customerId !== customerId 
    ) throw 'card verification error'

    // verify that the transaction exists and belongs to this card
    let transaction = await CreditCardTransaction.findAll({
      where: {
        transactionId: transactionId
      }
    });
    if(
      // couldn't find the transaction
      transaction.length == 0
      // transaction doesn't belong to this card            
      || transaction[0].creditCardNumber !== creditCard[0].creditCardNumber 
    ) throw 'transaction verification error'
    
    let transactiondetails = await TransactionDetails.findAll({
      where: {
        transactionId: transactionId
      },
      include: VendorItem
    });

    transactiondetails = {
      total: transaction[0].total,
      orderItems: transactiondetails.map(details => {
        return { 
            itemName: details.vendoritem.itemName,
            itemDescription: details.vendoritem.itemDescription,
            price: details.vendoritem.price,
            imgLink: details.vendoritem.imgLink,
            quantity: details.quantity
          };
      })
    };
    
    return transactiondetails;

  } catch (err) {
    return { error: true };
  }
}
