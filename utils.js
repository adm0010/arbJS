const Web3 = require('web3');
const Tx = require('ethereumjs-tx').Transaction;

const web3 = new Web3(Web3.givenProvider || 'https://bsc-dataseed.binance.org/');
const BIGNUMBER = web3.utils.BN;
// private key
const PRIVATEKEY_DICT = require(__dirname + "/privateKeys.json");
const PRIVATE_KEY_BINANCE = PRIVATEKEY_DICT['binance'];
const PRIVATE_KEY_METAMASK = PRIVATEKEY_DICT['metaMask'];
const PRIVATE_BUFFER_BINANCE = Buffer.from(PRIVATE_KEY_BINANCE, 'hex');
const PRIVATE_BUFFER_METAMASK = Buffer.from(PRIVATE_KEY_METAMASK, 'hex');

// account
const ACCOUNT_BINANCE= web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY_BINANCE)
const ACCOUNT_METAMASK = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY_METAMASK)

// abis
const ABI_DIR = __dirname + "/abi/";
const FACTORY_ABI = require(ABI_DIR + 'factory.json');
const PAIR_ABI = require(ABI_DIR + 'pair.json');
const ROUTER_ABI = require(ABI_DIR + 'router.json');
const ERC20_ABI = require(ABI_DIR + 'ERC20.json');
const PARTITION_FULL_ABI = require(ABI_DIR + 'partition_full.json');

// contract Address
const BAKERY_FACTORY_ADDRESS = "0x01bF7C66c6BD861915CdaaE475042d3c4BaE16A7";
const PANCAKE_FACTORY_ADDRESS = "0xBCfCcbde45cE874adCB698cC183deBcF17952812";
const PANCAKE_ROUTER_ADDRESS = "0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F";
const BAKERY_ROUTER_ADDRESS = "0xCDe540d7eAFE93aC5fE6233Bee57E1270D3E330F";
const PARTITION_FULL_ADDRESS = "0x536c13d444F5A10bB92962396ABA4d54D1450396";
// token addresses
const KLTT1_ADDRESS = "0x5af0eed3081599edbae5fd737c5b9ae8164633c1";
const KLTT2_ADDRESS = "0x75a62b2e39c31d4da510bb41ca0ca61f6d9cd98a";

// contracts
const BAKERY_FACTORY = new web3.eth.Contract(
    FACTORY_ABI,
    BAKERY_FACTORY_ADDRESS
);
const PANCAKE_FACTORY = new web3.eth.Contract(
    FACTORY_ABI,
    PANCAKE_FACTORY_ADDRESS
);
const bakeryRouter = new web3.eth.Contract(
    ROUTER_ABI,
    BAKERY_ROUTER_ADDRESS
);
const PARTITION_FULL = new web3.eth.Contract(
    PARTITION_FULL_ABI,
    PARTITION_FULL_ADDRESS
)

// other constant config
const DIGIT = 18;
const INT_UNIT = 10 ** DIGIT;

function amountAInAmountBOut(reserveA, reserveB, amountAIn){
    reserveA = Number(reserveA);
    reserveB = Number(reserveB);
    amountAIn = Number(amountAIn);
    
    var denominator = reserveA + amountAIn;
    return reserveB * (1 - reserveA / denominator)
}

function arbiProfit(firstInRsv, firstOutRsv, secondInRsv, secondOutRsv, firstInAmt){
    var tempOut = amountAInAmountBOut(firstInRsv, firstOutRsv, firstInAmt);
    var finalOut = amountAInAmountBOut(secondInRsv, secondOutRsv, tempOut);
    var profit = finalOut - firstInAmt;
    return profit;
}

function arbiProfitOptimize(firstInRsv, firstOutRsv, secondInRsv, secondOutRsv){
    
    var rightEndInput = 1 * 2;
    var rightEndProfit = arbiProfit(firstInRsv, firstOutRsv, secondInRsv, secondOutRsv, rightEndInput);
    
    // determine left and right endpoints
    var tempInput;
    var tempProfit;
    
    //console.log(rightEndInput, rightEndProfit);
    while (true){
        tempInput = rightEndInput * 2;
        tempProfit = arbiProfit(firstInRsv, firstOutRsv, secondInRsv, secondOutRsv, tempInput);
        if (tempProfit < rightEndProfit){
            rightEndInput = tempInput;
            rightEndProfit = tempProfit;
            //console.log(rightEndInput, rightEndProfit, 'end')
            break;
        } else {
            rightEndInput = tempInput;
            rightEndProfit = tempProfit;
        }
        //console.log(loopDepth, rightEndInput, rightEndProfit);
    }
    var leftEndInput = rightEndInput / 4;
    var leftEndProfit = arbiProfit(firstInRsv, firstOutRsv, secondInRsv, secondOutRsv, leftEndInput);

    const partitionCnt = 20;
    var loopDepth = 0;
    while(true){
        // create partitions
        var stepSize = (rightEndInput - leftEndInput) / partitionCnt;
        var inputArr = [leftEndInput];
        var profitArr = [leftEndProfit];
        for (i=1; i<=partitionCnt; i++){
            thisInput = leftEndInput + stepSize * i;
            thisProfit = arbiProfit(firstInRsv, firstOutRsv, secondInRsv, secondOutRsv, thisInput);
            inputArr.push(thisInput);
            profitArr.push(thisProfit);
        }
        //console.log(inputArr);
        //console.log(profitArr);

        // locate profit optimizing input
        var tempMax = 0;
        var tempIdx = 0;
        for (i=0; i<profitArr.length; i++){
            if(profitArr[i] >= tempMax){
                tempMax = profitArr[i];
                tempIdx = i;
            }
        }
        
        //renew interval
        leftEndIdx = Math.max(0, tempIdx - 1);
        rightEndIdx = Math.min(profitArr.length - 1, tempIdx + 1);
        leftEndInput = inputArr[leftEndIdx];
        leftEndProfit = profitArr[leftEndIdx];
        rightEndInput = inputArr[rightEndIdx];

        // terminate condition
        if ((rightEndInput - leftEndInput) < 0.00001){
            console.log(loopDepth, "new interval", leftEndInput, rightEndInput);
            return (rightEndInput + leftEndInput) / 2;
        };
        
        loopDepth += 1;
    }
    
}

module.exports = {
    web3: web3,

    PRIVATE_KEY_BINANCE: PRIVATE_KEY_BINANCE,
    PRIVATE_BUFFER_BINANCE: PRIVATE_BUFFER_BINANCE,
    ACCOUNT_BINANCE: ACCOUNT_BINANCE,

    ABI_DIR: ABI_DIR,
    FACTORY_ABI: FACTORY_ABI,
    PAIR_ABI: PAIR_ABI,
    ROUTER_ABI: ROUTER_ABI,
    ERC20_ABI: ERC20_ABI,

    PANCAKE_FACTORY_ADDRESS: PANCAKE_FACTORY_ADDRESS,
    PANCAKE_ROUTER_ADDRESS: PANCAKE_ROUTER_ADDRESS,
    BAKERY_FACTORY_ADDRESS: BAKERY_FACTORY_ADDRESS,
    BAKERY_ROUTER_ADDRESS: BAKERY_ROUTER_ADDRESS,
    PARTITION_FULL_ADDRESS: PARTITION_FULL_ADDRESS,
    KLTT1_ADDRESS: KLTT1_ADDRESS,
    KLTT2_ADDRESS: KLTT2_ADDRESS,

    // contracts
    BAKERY_FACTORY: BAKERY_FACTORY,
    PANCAKE_FACTORY: PANCAKE_FACTORY,
    PARTITION_FULL: PARTITION_FULL,

    DIGIT: DIGIT,
    INT_UNIT: INT_UNIT,

    amountAInAmountBOut: amountAInAmountBOut,
    arbiProfit: arbiProfit,
    arbiProfitOptimize: arbiProfitOptimize

}