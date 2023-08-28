const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Customer = require('./models/customer');
const BankAccount = require('./models/bank_account');
const Transaction = require('./models/transaction');

const BAD_CUSTOMER_ID = "Invalid customer id";
const BAD_SENDER_ID = "Invalid sender id";
const BAD_RECEIVER_ID = "Invalid receiver id";
const BAD_OWNER_SENDER = "Sending bank account does not belong to sending customer";
const BAD_OWNER_RECEIVER = "Receiving bank account does not belong to receiving customer";
const NO_TRANSACTIONS_FOUND = "No transactions found";
const NO_BALANCES_FOUND = "No balances found";
const INSUFFICIENT_FUNDS = "Insufficient funds";
const BAD_INITIAL_DEPOSIT = "Initial deposit be a number and equal or greater than zero";
const NO_ACCOUNT_FOUND = "No account found with that id";
const ACCOUNT_CREATED = "Account successfully created";
const NO_ACCOUNT_CREATED = "Failed to create an account";
const TRANSFER_COMPLETED = "Transfer successful";
const HISTORY_FETCHED = "Returned all transactions";
const BAD_AMOUNT = "Amount must be greater than or equal to zero";
const NO_TRANSFER = "Transfer failed";
const FAIL_GET_BALANCES = "Failed to retrieve account balances";
const FAIL_GET_TRANSACTIONS = "Failed to retrieve transaction history"

/*
  * Create a new bank account for a customer, with an initial deposit amount. A
  * single customer may have multiple bank accounts. If a customer does not
  * exist, return an error. If the deposit is less than zero, return an error
  * that
  * the deposit must be equal to or greater than zero.
  */
router.post('/createBankAccount', async (req, res) => {
  try {
    // Extract the necessary data from the request body
    const { customerId, initialDeposit } = req.body;

    if ( await isValidCustomer(customerId)) {
      return res.status(404).json({ error: BAD_CUSTOMER_ID });
    }

    if(initialDeposit < 0){
      return res.status(404).json({ error: BAD_INITIAL_DEPOSIT });
    }

    // Create a new account instance
    const newAccount = new BankAccount({
      accountId: generateAccountId(), 
      customerId,
      balance: initialDeposit,

    });

    newAccount.save();

    return res.status(201).json({ message: ACCOUNT_CREATED });
  } catch (error) {
  console.log(error);
    return res.status(500).json({ error: NO_ACCOUNT_CREATED });
  }
});

/*
* Transfer amounts between any two accounts, including those owned by
* different customers.
* NOTE: transaction details is a string generated in the function.
* "FROM {sender_name} {amount} TO {reciever_name}"
* 
*/
router.post('/transfer', async (req, res) => {

    try {
      const { fromAccountId, toAccountId, amount, fromCustomerId, toCustomerId } = req.body;
  
      if(amount < 0){
        return res.status(404).json({error: BAD_AMOUNT})
      }
      
      if ( await isValidCustomer(toCustomerId)) {
        return res.status(400).json({ error: BAD_RECEIVER_ID });
      }

      if ( await isValidCustomer(fromCustomerId)) {
        return res.status(400).json({ error: BAD_SENDER_ID });
      }

      if (!isValidBankAccount(toAccountId)) {
        return res.status(400).json({ error: NO_ACCOUNT_FOUND });
      }

      if (!isValidBankAccount(fromAccountId)) {
        return res.status(400).json({ error: NO_ACCOUNT_FOUND });
      }

      if(!customerOwnsBankAccount(fromCustomerId, fromAccountId)){
        return res.status(400).json({error: BAD_OWNER_SENDER });
      }

      if(!customerOwnsBankAccount(toCustomerId, toAccountId)){
        return res.status(400).json({error: BAD_OWNER_RECEIVER });
      }

      const destinationAccount = await BankAccount.findById(toAccountId);
      const sourceAccount = await BankAccount.findById(fromAccountId);

      if (sourceAccount.balance < amount) {
        return res.status(400).json({ error: INSUFFICIENT_FUNDS });
      }
    
      sourceAccount.balance -= amount;
      destinationAccount.balance += amount;

      await sourceAccount.save();
      await destinationAccount.save();
  
      const newTransaction = new Transaction({
        transferId: generateTransferId(),
        fromBankAccountId: fromAccountId,
        toBankAccountId: toAccountId,
        amount: amount,
        transactionDetails: "FROM " + Customer.findById(fromCustomerId).name + " " + 
          amount + " TO " + Customer.findById(toCustomerId).name
      });
  
      await newTransaction.save();

      return res.status(201).json({ message: TRANSFER_COMPLETED});
    } catch (error) {
  console.log(error);
      return res.status(500).json({ error: NO_TRANSFER });
    }
  
});

/**
 * Get all balances for a customer. If no valid customer, return an error that
 * customer doesn't exist. Else, return list.
 * 
*/
router.get('/balances/:customerId', async(req, res) => {
  try {
    const customerId = req.params.customerId;
    if(!isValidCustomer(customerId)){
      return res.status(404).json({ error: BAD_CUSTOMER_ID });
    }

    const cust = Customer.findById(customerId);
    const accounts = await BankAccount.find({ customerId });
    
    const accountBalances = accounts.map((account) => ({
      bankAccountId: account.bankAccountId,
      balance: account.balance,
    }));

    if(accountBalances.length === 0){
      return res.status(200).json({ balances: NO_BALANCES_FOUND})
    }
    return res.json({ balances: accountBalances });
  } catch (error) {
  console.log(error);
    return res.status(500).json({ error: FAIL_GET_BALANCES });
  }
});

/**
 * Fetch the transaction history for a given customer id. If a customer id that
 * doesnt exist is handed in, returns an error that the customer does not exist.
 * If the list is empty, return a notification that the list is empty. Else,
 * return list of transactions.
 */
router.get('/transaction-history/:customerId', async (req, res) => {
  try{

  const customerId = parseInt(req.params.customerId);
  console.log(customerId);
  if(!isValidCustomer(customerId)){
    return res.status(400).json({ error: BAD_CUSTOMER_ID});
  }
  const transactions = await Transaction.find();
  if(transactions.length === 0){
    return res.status(200).json({transactions: [], NO_TRANSACTIONS_FOUND});
  }
  const  transactionDetails = transactions.map((t) =>{
    console.log(customerId);
      return t.transactionDetails[0];
  });
  //const transactions = await Transaction.find({ $or: [{ sender: customerId }, { receiver: customerId }] });


  return res.status(200).json({transactions: transactionDetails, HISTORY_FETCHED});

  }catch (error) {
  console.log(error);
    return res.status(500).json({ error: FAIL_GET_TRANSACTIONS });
  }
});

 function  isValidCustomer(customerId){
   Customer.findOne({_id: customerId}).then( customer =>{
    console.log(customer);
    return customer != null
  }).catch(err =>{
    console.log(err);
    return false;
  })

}
async function isValidBankAccount(bankAccountId){
  const account = await BankAccount.findOne({_id: bankAccountId});
  return account != null;
}
async function customerOwnsBankAccount(customerId, bankAccountId){
  if(isValidBankAccount(bankAccountId) && isValidCustomer(customerId)){
    return BankAccount.findById(bankAccountId).customerId === customerId;
  }
}

module.exports = router;
