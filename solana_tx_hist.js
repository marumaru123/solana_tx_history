const solanaWeb3 = require('@solana/web3.js');
//import { BigNumber } from "bignumber.js";
const BigNumber = require('bignumber.js');
const fs = require('fs');

let pubkey = new solanaWeb3.PublicKey(process.argv[2]);
let con = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com");

let record = [];

const maximumFractionDigits = 9;

const tokenMap = JSON.parse(fs.readFileSync('./token.json', 'utf8'));

let accountInfoMap = {};

async function fn3(sig) {
    let result;
    if (!accountInfoMap[sig]) {
      const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "confirmed");
      result = await connection.getParsedAccountInfo(new solanaWeb3.PublicKey(sig));
      accountInfoMap[sig] = result;
    } else {
      result = accountInfoMap[sig];
    }
    if (result.value != null) {
      if (result.value.data.program === 'spl-token') {
          if (result.value.data.parsed.info.owner === process.argv[2]) {
	    return true;
	  }
      }
    }
    return false;
}
async function lamportsToSol(lamports) {
    const LAMPORTS_PER_SOL = 1000000000;
    if (typeof lamports === "number") {
        return Math.abs(lamports) / LAMPORTS_PER_SOL;
    }

    let signMultiplier = 1;
    if (lamports.isNeg()) {
        signMultiplier = -1;
    }

    const absLamports = lamports.abs();
    const lamportsString = absLamports.toString(10).padStart(10, "0");
    const splitIndex = lamportsString.length - 9;
    const solString =
    lamportsString.slice(0, splitIndex) +
	    "." +
	    lamportsString.slice(splitIndex);
    return signMultiplier * parseFloat(solString);
}
async function lamportsToSolString(lamports) {
  const sol = await lamportsToSol(lamports);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(sol);
}

async function balanceDelta(delta, isSol) {
    let sols;
    if (isSol) {
      sols = await lamportsToSolString(delta.toNumber());
    }
    if (delta.gt(0)) {
      if (isSol) {
	      return "+" + sols;
      } else {
	      return "+" + delta.toString();
      }
    } else if (delta.lt(0)) {
      if (isSol) {
	      return "-" + sols;
      } else {
	      return "-" + delta.toString();
      }
    }
}

async function createTokenBalancesMap(tokenBalances, pubkeys) {
  let tokenBalancesMap = {};
  for (let i = 0; i < tokenBalances.length; i++ ) {
    const tokenBalance = tokenBalances[i];
    const pubkey = pubkeys[tokenBalance['accountIndex']];
    if (await fn3(pubkey)) {
      tokenBalancesMap[pubkey] = tokenBalance.uiTokenAmount.uiAmount;
    }
  }
  return tokenBalancesMap;
}

async function createTokenBalance(postTokenBalances, pubkeys, preTokenBalancesMap) {
  let tokenBalanceRecord = [];
  for (let i = 0; i < postTokenBalances.length; i++ ) {
    const postTokenBalance = postTokenBalances[i];
    const pubkey = pubkeys[postTokenBalance['accountIndex']];
    if (await fn3(pubkey)) {
      let preAmount  = preTokenBalancesMap[pubkey] ? preTokenBalancesMap[pubkey] : 0;
      const uiAmount = postTokenBalance.uiTokenAmount.uiAmount;
      let postAmount = uiAmount != null ? uiAmount : 0;
      const delta    = new BigNumber(postAmount).minus(new BigNumber(preAmount));
      const mint     = postTokenBalance['mint'];
      if (tokenMap[mint]) {
         tokenBalanceRecord.push(tokenMap[mint]); 
      } else {
         tokenBalanceRecord.push(mint); 
      }
      tokenBalanceRecord.push(delta); 
      tokenBalanceRecord.push(postAmount); 
    }
  }
  return tokenBalanceRecord;
}

async function createSolBalance(tx, fee) {
  let solRecord = [];
  for (let i = 0; i < tx.transaction.message.accountKeys.length; i++ ) {
    const accountKey = tx.transaction.message.accountKeys[i];
    const pre     = tx.meta.preBalances[i];
    const post    = tx.meta.postBalances[i];
    const pubkey  = accountKey.pubkey;
    const key     = accountKey.pubkey.toBase58();
    const delta   = new BigNumber(post).minus(new BigNumber(pre));
    const sol     = await lamportsToSol(post);
    const maximumFractionDigits = 9
    const val = new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(sol);
    if (key === process.argv[2]) {
      if (i === 0) {
        solRecord.push(fee);
        solRecord.push(await balanceDelta(delta,true));
        solRecord.push(val); 
      } else {
        solRecord.push(0);
        solRecord.push(await balanceDelta(delta,true));
        solRecord.push(val); 
      }
    }
  }
  return solRecord;
}

async function fnn() {
    record.splice(0);
    record.push('txid');
    record.push('date time');
    record.push('fee');
    record.push('sol delta');
    record.push('sol post amount');
    record.push('currency1');
    record.push('currency1 delta');
    record.push('currency1 post amount');
    record.push('currency2');
    record.push('currency2 delta');
    record.push('currency2 post amount');
    record.push('currency3');
    record.push('currency3 delta');
    record.push('currency3 post amount');
    console.log(record.join(','));
    const fetched = await con.getConfirmedSignaturesForAddress2(pubkey);
    const signatures = fetched.map(val => val['signature']);
    for (let i = 0; i < signatures.length ; i++ ) {
        const tx = await con.getParsedConfirmedTransaction(signatures[i]);
	record.splice(0);
	record.push(signatures[i]);
	let dateTime = new Date(tx.blockTime * 1000);
	record.push(dateTime.toString());
	let fee = await lamportsToSolString(tx.meta.fee);
	const solRecord = await createSolBalance(tx, fee); 
	record = record.concat(solRecord);
        const pubkeys = tx.transaction.message.accountKeys.map(value => value.pubkey.toString());
	let preTokenBalancesMap = await createTokenBalancesMap(tx.meta.preTokenBalances, pubkeys);
	const tokenBalanceRecord = await createTokenBalance(tx.meta.postTokenBalances, pubkeys, preTokenBalancesMap); 
	record = record.concat(tokenBalanceRecord);
	console.log(record.join(','));
    }
}

fnn();
