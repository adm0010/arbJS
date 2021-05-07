const utils = require('./utils');
const web3 = utils.web3;

var init = async() => {
    var pairAddressOnPancake = await utils.PANCAKE_FACTORY.methods.getPair(
        utils.KLTT1_ADDRESS, utils.KLTT2_ADDRESS).call();
    var pairAddressOnBakery = await utils.BAKERY_FACTORY.methods.getPair(
        utils.KLTT1_ADDRESS, utils.KLTT2_ADDRESS).call();
    
    console.log(pairAddressOnPancake, pairAddressOnBakery)
    const pairOnPancake = new web3.eth.Contract(
        utils.PAIR_ABI,
        pairAddressOnPancake
    )
    const pairOnBakery = new web3.eth.Contract(
        utils.PAIR_ABI,
        pairAddressOnBakery
    )
    
    var tempAdr = await pairOnPancake.methods.token0().call();
    var pancakeReserves = await pairOnPancake.methods.getReserves().call();
    var bakeryReserves = await pairOnBakery.methods.getReserves().call();

    var kltt1_pnckRsv = Number(pancakeReserves['0']) / utils.INT_UNIT;
    var kltt2_pnckRsv = Number(pancakeReserves['1']) / utils.INT_UNIT;
    var kltt1_bkryRsv = Number(bakeryReserves['0'] / utils.INT_UNIT);
    var kltt2_bkryRsv = Number(bakeryReserves['1'] / utils.INT_UNIT);

    var k_pnck = kltt1_pnckRsv * kltt2_pnckRsv;
    var k_bkry = kltt1_bkryRsv * kltt2_bkryRsv;
    
    var tokenRatio_pnck = kltt1_pnckRsv / kltt2_pnckRsv;
    var tokenRatio_bkry = kltt1_bkryRsv / kltt2_bkryRsv;
   
    //var pnckFirst = true;
    //var kltt1FirstIn = true;
    var firstInRsv, firstOutRsv, secondInRsv, secondOutRsv;
    var _platform1, _platform2, firstWay, secondWay
    if (k_pnck <= k_bkry){
        // k_bkry is larger, use ratio in bkry to determine first in token;
        //pnckFirst = true;
        _platform1 = utils.PANCAKE_ROUTER_ADDRESS;
        _platform2 = utils.BAKERY_ROUTER_ADDRESS;
        if (tokenRatio_bkry > tokenRatio_pnck){
            //kltt1FirstIn = true;
            firstWay = [utils.KLTT1_ADDRESS, utils.KLTT2_ADDRESS];
            secondWay = [utils.KLTT2_ADDRESS, utils.KLTT1_ADDRESS];
            firstInRsv = kltt1_pnckRsv;
            firstOutRsv = kltt2_pnckRsv;
            secondInRsv = kltt2_bkryRsv;
            secondOutRsv = kltt1_bkryRsv;
        } else {
            //kltt1FirstIn = false;
            firstWay = [utils.KLTT2_ADDRESS, utils.KLTT1_ADDRESS];
            secondWay = [utils.KLTT1_ADDRESS, utils.KLTT2_ADDRESS];
            firstInRsv = kltt2_pnckRsv;
            firstOutRsv = kltt1_pnckRsv;
            secondInRsv = kltt1_bkryRsv;
            secondOutRsv = kltt2_bkryRsv;
        }
    } else {
        //pnckFirst = false;
        _platform1 = utils.BAKERY_ROUTER_ADDRESS;
        _platform2 = utils.PANCAKE_ROUTER_ADDRESS;
        // k_pnck is larger use ration in bkry to determine first in token;
        if (tokenRatio_pnck > tokenRatio_bkry){
            firstWay = [utils.KLTT1_ADDRESS, utils.KLTT2_ADDRESS];
            secondWay = [utils.KLTT2_ADDRESS, utils.KLTT1_ADDRESS];
            //kltt1FirstIn = true;
            firstInRsv = kltt1_bkryRsv;
            firstOutRsv = kltt2_bkryRsv;
            secondInRsv = kltt2_pnckRsv;
            secondOutRsv = kltt1_pnckRsv;
        } else {
            //kltt1FirstIn = false;
            firstWay = [utils.KLTT2_ADDRESS, utils.KLTT1_ADDRESS];
            secondWay = [utils.KLTT1_ADDRESS, utils.KLTT2_ADDRESS];
            firstInRsv = kltt2_bkryRsv;
            firstOutRsv = kltt1_bkryRsv;
            secondInRsv = kltt1_pnckRsv;
            secondOutRsv = kltt2_pnckRsv
        }
    }
    
    // output = {
    //     'pnck fist': pnckFirst,
    //     'kltt1 first in': kltt1FirstIn,
    //     'kltt1 pnck rsv': kltt1_pnckRsv,
    //     'kltt2 pnck rsv': kltt2_pnckRsv,
    //     'kltt1 bkry rsv': kltt1_bkryRsv,
    //     'kltt2 bkry rsv': kltt2_bkryRsv,
    //     'k_pnck': k_pnck,
    //     'k_bkry': k_bkry,
    //     tokenRatio_pnck: tokenRatio_pnck,
    //     tokenRatio_bkry: tokenRatio_bkry
    // }
    //console.log(output);
    
    //var tempOut = utils.amountAInAmountBOut(kltt1_bkryRsv, kltt2_bkryRsv, 1);
    //var finalOut = utils.amountAInAmountBOut(kltt2_pnckRsv, kltt1_pnckRsv, tempOut);
    //var profit = utils.arbiProfit(kltt1_bkryRsv, kltt2_bkryRsv, kltt2_pnckRsv, kltt1_pnckRsv, 2);

    var optimizedInput = utils.arbiProfitOptimize(firstInRsv, firstOutRsv, secondInRsv, secondOutRsv);
    var optimizedInputString = (optimizedInput / 2 * utils.INT_UNIT).toString();
    console.log(optimizedInput, optimizedInputString);

    const txData = utils.PARTITION_FULL.methods.tokenAInTokenBOut(
        _platform1,
        _platform2,
        optimizedInputString,
        firstWay,
        secondWay
    ).encodeABI();

    const nonce = await web3.eth.getTransactionCount(utils.ACCOUNT_BINANCE.address);
    console.log(nonce)
    
    const txObject = {
        nonce: web3.utils.toHex(nonce),
        to: utils.PARTITION_FULL_ADDRESS,
        data: txData,
        gas: 400000,
    }
    
    // web3.eth.accounts.signTransaction(
    //     txObject, utils.PRIVATE_KEY_BINANCE 
    // ).then(signedTx => {
    //     console.log(signedTx.transactionHash);
    //     web3.eth.sendSignedTransaction(
    //         signedTx.rawTransaction
    //     ).on('receipt', console.log);
    // })
};

init();