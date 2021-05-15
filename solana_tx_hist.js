const solanaWeb3 = require('@solana/web3.js');
//import { BigNumber } from "bignumber.js";
const BigNumber = require('bignumber.js');
const fs = require('fs');

let pubkey = new solanaWeb3.PublicKey(process.argv[2]);
let con = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com");

let record = [];

const maximumFractionDigits = 9;

const tokenMap = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
/*
const tokenMap = {
	'4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R':'RAY',
	'8PMHT4swUMtBzgHnh5U564N5sjPSiUz2cjEQzFnnP1Fo':'ROPE',
	'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':'USDC',
	'6SfhBAmuaGf9p3WAxeHJYCWMABnYUMrdzNdK5Stvvj4k':'Orca ROPE/SOL'
}
*/

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
	  //console.log(result.value.data.parsed.info.owner + "::" + process.argv[2]);
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

async function fnn() {
    record.splice(0);
    record.push('txid');
    record.push('date time');
    record.push('fee');
    record.push('feepayer');
    record.push('sol delta');
    record.push('sol post amount');
    console.log(record.join(','));
    const fetched = await con.getConfirmedSignaturesForAddress2(pubkey);
    const signatures = fetched.map(val => val['signature']);
    for (let i = 0; i < signatures.length ; i++ ) {
        const value2 = await con.getParsedConfirmedTransaction(signatures[i]);
	//console.log(value2);
        //console.log('');
        //console.log('***** start *****');
        //console.log(signatures[i]);
	record.splice(0);
	record.push(signatures[i]);
	let dateTime = new Date(value2.blockTime * 1000);
	record.push(dateTime.toString());
        //console.log('');
        //console.log('fee:' + await lamportsToSolString(value2.meta.fee));
	//record.push(await lamportsToSolString(value2.meta.fee));
	let fee123 = await lamportsToSolString(value2.meta.fee);
        for (let j = 0; j < value2.transaction.message.accountKeys.length; j++ ) {
	    const value31 = value2.transaction.message.accountKeys[j];
	    const pre = value2.meta.preBalances[j];
	    const post = value2.meta.postBalances[j];
	    const pubkey = value31.pubkey;
	    const key = value31.pubkey.toBase58();
	    const delta = new BigNumber(post).minus(new BigNumber(pre));
	    const sol = await lamportsToSol(post);
	    const maximumFractionDigits = 9
	    const val = new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(sol);
	    const val222 = [key]; 
		/*
	    if (j = 0) {
		const aiueo1 = ": Fee Payer";
	    } else {
		const aiueo1 = "";
	    }
	    */
	    val222.push(": ");
            val222.push(await balanceDelta(delta,true));
	    val222.push(":" + val); 
	    if (j === 0) {
		val222.push(": Fee Payer");
	    }
	    if (!value31.writable) {
		val222.push(": Readonly");
	    }
	    if (value31.signer) {
		val222.push(": Signer");
	    }
	    if (value2.transaction.message.instructions.find((ix) => ix.programId.equals(pubkey))) {
		val222.push(": Program");
	    }
	    if (key === process.argv[2]) {
	      if (j === 0) {
	          //console.log(val222.join(''));
		  record.push(fee123);
		  record.push(await balanceDelta(delta,true));
	          record.push(val); 
	      } else {
	          //console.log(val222.join(''));
		  record.push(0);
		  record.push(await balanceDelta(delta,true));
	          record.push(val); 
	      }
	    }
		/*
	    const val222 = key + ":" + post; 
	    let aiueo1
	    if (j = 0) {
		aiueo1 = ": Fee Payer";
	    } else {
		aiueo1 = "";
	    }
	    if (!value31.writable) {
		val222.push(": Fee Payer");
		val222 += ": Readonly";
	    }
	    if (value31.signer) {
		val222 += ": Signer";
	    }
	    */
	    //if (value2.transaction.message.instructions.find((ix) => ix.programId.equals(pubkey))) {
//		val += ": Program";
//	    }
	    //await console.log(val222);
	}
        //console.log(value2);
        //console.log(signatures[i]);
        const accouts = value2.transaction.message.accountKeys.map(aiueo => aiueo.pubkey.toString());
	let preTokenBalances2 = {};
        if (value2.meta.preTokenBalances.length > 0) {
            //console.log('');
            for (let j = 0; j < value2.meta.preTokenBalances.length; j++ ) {
	        const value3 = value2.meta.preTokenBalances[j];
	        const account2 = accouts[value3['accountIndex']];
		if (await fn3(account2)) {
		    //console.log(accouts[value3['accountIndex']] + ':' + 
		    //value3['mint'] + ':' + 
		    //value3.uiTokenAmount.uiAmount);
		    preTokenBalances2[account2] = value3.uiTokenAmount.uiAmount;
		}
            }
	}
	//console.log(preTokenBalances2);
	if (value2.meta.postTokenBalances.length > 0) {
            //console.log('');
            for (let j = 0; j < value2.meta.postTokenBalances.length; j++ ) {
	        const value3 = value2.meta.postTokenBalances[j];
	        const account2 = accouts[value3['accountIndex']];
		if (await fn3(account2)) {
		    //console.log(accouts[value3['accountIndex']] + ':' + 
		    //value3['mint'] + ':' + 
		    //value3.uiTokenAmount.uiAmount);
	            let preAmount;
		    if (preTokenBalances2[account2]) {
			    preAmount = preTokenBalances2[account2];
		    } else {
			    preAmount = 0;
		    }
		    let postAmount;
		    if (value3.uiTokenAmount.uiAmount != null) {
			    postAmount = value3.uiTokenAmount.uiAmount;
		    } else {
			    postAmount = 0;
		    }
	            const delta = new BigNumber(postAmount).minus(new BigNumber(preAmount));
	            if (tokenMap[value3['mint']]) {
	                record.push(tokenMap[value3['mint']]); 
		    } else {
	                record.push(value3['mint']); 
		    }
	            record.push(delta); 
	            record.push(postAmount); 
		}
            }
	}
	//console.log('***** end *****');
	console.log(record.join(','));
    }
}

//console.log(tokenMap);
//console.log(tokenMap['6SfhBAmuaGf9p3WAxeHJYCWMABnYUMrdzNdK5Stvvj4k']);
fnn();
