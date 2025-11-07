
let ws_markPrice, message_data_markPrice;
let ws_bookTicker, message_data_bookTicker;
let ws_trade, message_data_trade, message_trade;
let volume = 0, prev_volume = 0, message_data_volume = 0;
let OI = 0, prev_OI = 0;
let price = 0, prev_price = 0;
let funding_rate = 0, prev_funding_rate = 0;
let block_binance_status = document.querySelector('.binance-status');
let api_error = false;
let maker = 'nothing', price_trade = 0, price_bid = 0, price_ask = 0, volume_maker = 0, volume_taker = 0, prev_price_ask = 0, prev_price_bid = 0;
let volume_maker_5 = 0, volume_taker_5 = 0, volume_maker_10 = 0, volume_taker_10 = 0;
let timer_OI, timer_price, timer_maker_taker, timer_volume, timer_zero, output_console;
let server_timestamp = 0, server_hour = 0, server_minutes = 0, server_time = 0;

let result_funding_rate = document.querySelector('.binance .funding-rate .result');
let result_OI = document.querySelector('.binance .OI .result');
let result_volume = document.querySelector('.binance .volume .result');
let result_price = document.querySelector('.binance .price .result');
let result_maker = document.querySelector('.binance .maker .result');
let result_taker = document.querySelector('.binance .taker .result');

//connect_trade();

block_binance_status.classList.add('background-red');

//connectBinance();

function connectBinance() {

    ws_markPrice = new WebSocket('wss://fstream.binance.com/ws/btcusdt@markPrice');

    ws_markPrice.onopen = () => {

        ws_markPrice.send(JSON.stringify({
            "method": "SUBSCRIBE",
            "params": [
                "btcusdt@markPrice"
            ],
            "id": 1
        }));

        if (ws_markPrice.readyState == 1) {
            block_binance_status.innerHTML = 'Статус: Подключен';
            block_binance_status.classList.remove('background-red');
            block_binance_status.classList.add('background-green');
        }
    }

    messageBinance();
    connect_trade();
    timer_OI = setInterval(getOI, 300000);
    timer_price = setInterval(calc_price, 300000);
    timer_maker_taker = setInterval(calc_maker_taker, 300000);
    timer_volume = setInterval(calc_volume, 300000);

    // calc_maker_taker();

    output_console = setInterval(output, 300000);

    timer_zero = setInterval(zero, 300000);



    // console.log(price.toFixed(2), ';', volume_taker.toFixed(), ';', volume_maker.toFixed(), ';', OI.toFixed(), ';', volume.toFixed(), ';', funding_rate);
}

function disconnectBinance() {
    ws_markPrice.close(1000, 'work end');
    ws_trade.close(1000, 'work end');
    clearInterval(timer_OI);
    clearInterval(timer_price);
    clearInterval(timer_maker_taker);
    clearInterval(timer_volume);
    clearInterval(output_console);

    if (ws_markPrice.readyState > 1 && ws_trade.readyState > 1) {
        block_binance_status.innerHTML = 'Статус: Отключен';
        block_binance_status.classList.remove('background-green');
        block_binance_status.classList.add('background-red');
    }
}

function output() {
    //   console.log(';', price.toFixed(2), ';', volume_taker.toFixed(), ';', volume_maker.toFixed(), ';', OI.toFixed(), ';', volume.toFixed(), ';', funding_rate, ';');
    console.log(';', price.toFixed(2), ';', (volume_maker - volume_taker).toFixed(), ';', OI.toFixed(), ';', volume.toFixed(), ';', funding_rate, ';');
    console.log('M_5 = ', volume_maker_5.toFixed(), ', T_5 = ', volume_taker_5.toFixed(), ', M_10 = ', volume_maker_10.toFixed(), ', T_10 = ', volume_taker_10.toFixed());
    console.log('------------------------------');
}

function zero() {
    volume = 0; volume_maker = 0; volume_taker = 0;
    volume_maker_5 = 0; volume_taker_5 = 0;
}

function messageBinance() {

    ws_markPrice.onmessage = (e_markPrice) => {

        message_data_markPrice = JSON.parse(e_markPrice.data);
        funding_rate = Math.round(+message_data_markPrice.r * 1000000) / 10000;
        price = +message_data_markPrice.p;

        if (funding_rate > prev_funding_rate && prev_funding_rate != 0) {  // Funding rate up

            // get_server_time(message_data_markPrice.E);
            result_funding_rate.innerHTML = /*server_hour + ':' + server_minutes + '  ' +*/ funding_rate;
            result_funding_rate.classList.remove('background-red');
            result_funding_rate.classList.add('background-green');
            // console.log(server_hour, ':', server_minutes, '. Funding rate увеличился ', funding_rate);

        }
        else if (funding_rate < prev_funding_rate && prev_funding_rate != 0) {  // funding-rate down
            //  get_server_time(message_data_markPrice.E);
            result_funding_rate.innerHTML = /*server_hour + ':' + server_minutes + '  ' +*/ funding_rate;
            result_funding_rate.classList.remove('background-green');
            result_funding_rate.classList.add('background-red');
            //  console.log(server_hour, ':', server_minutes, '. Funding rate уменьшился ', funding_rate);
        }

        prev_funding_rate = funding_rate;

        //  console.log(funding_rate);
    }
}

function get_server_time(server_timestamp) {
    server_time = new Date(server_timestamp);
    server_hour = server_time.getHours();
    server_minutes = server_time.getMinutes();
}

function connect_trade() {

    ws_trade = new WebSocket('wss://fstream.binance.com/stream?streams=btcusdt@traderade/btcusdt@bookTicker');

    ws_trade.onopen = () => {

        ws_trade.send(JSON.stringify({
            "method": "SUBSCRIBE",
            "params": [
                "btcusdt@trade",
                "btcusdt@bookTicker"
            ],
            "id": 1
        }));

        if (ws_trade.readyState == 1) {
            //  console.log('Trade подключен');
        }
    }


    ws_trade.onmessage = (e_trade) => {
        message_data_trade = JSON.parse(e_trade.data);

        message_trade = message_data_trade.data;


        // console.log(typeof (message_trade));

        if (message_trade != undefined && typeof (message_trade.e) == 'string' && message_trade.e == 'trade') {
            volume += +message_trade.q;
            price_trade = +message_trade.p;
            maker = message_trade.m;

            // console.log(typeof (message_trade.e), '. ', message_trade.e);

            if (maker && price_trade == price_bid) { volume_maker = volume_maker + +message_trade.q; }
            if (maker && price_trade == price_ask) { volume_maker = volume_maker - +message_trade.q; }

            if (!maker && price_trade == price_bid) { volume_taker = volume_taker - +message_trade.q; }
            if (!maker && price_trade == price_ask) { volume_taker = volume_taker + +message_trade.q; }

            if (maker && price_trade < price_bid && price_trade > price_bid - 5) { volume_maker_5 = volume_maker_5 + +message_trade.q; }
            if (maker && price_trade > price_ask && price_trade < price_ask + 5) { volume_maker_5 = volume_maker_5 - +message_trade.q; }

            if (!maker && price_trade < price_bid && price_trade > price_bid - 5) { volume_taker_5 = volume_taker_5 - +message_trade.q; }
            if (!maker && price_trade > price_ask && price_trade < price_ask + 5) { volume_taker_5 = volume_taker_5 + +message_trade.q; }

            if (maker && price_trade < price_bid && price_trade > price_bid - 10) { volume_maker_10 = volume_maker_10 + +message_trade.q; }
            if (maker && price_trade > price_ask && price_trade < price_ask + 10) { volume_maker_10 = volume_maker_10 - +message_trade.q; }

            if (!maker && price_trade < price_bid && price_trade > price_bid - 10) { volume_taker_10 = volume_taker_10 - +message_trade.q; }
            if (!maker && price_trade > price_ask && price_trade < price_ask + 10) { volume_taker_10 = volume_taker_10 + +message_trade.q; }
        }

        if (message_trade != undefined && typeof (message_trade.e) == 'string' && message_trade.e == 'bookTicker') {
            if (+message_trade.a != prev_price_ask) { price_ask = +message_trade.a; }
            if (+message_trade.b != prev_price_bid) { price_bid = +message_trade.b; }
            // console.log('ask = ', price_ask, ', bid = ', price_bid);

            prev_price_ask = price_ask;
            prev_price_bid = price_bid;
        }
        //console.log('trade = ', price_trade.toFixed(2), ', volume = ', (+message_data_trade.q).toFixed(3), ', maker = ', maker);

        //  return volume_maker, volume_taker;
    }

}





function calc_maker_taker() {

    // console.log(price_ask, price_bid);

    if (volume_maker > 0) {  // Maker up

        //get_server_time(message_data_markPrice.E);
        result_maker.innerHTML = volume_maker.toFixed();
        result_maker.classList.remove('background-red');
        result_maker.classList.add('background-green');
        //  console.log('OI увеличился ', OI);
    }
    else if (volume_maker < 0) {  // OI down
        // get_server_time(message_data_markPrice.E);
        result_maker.innerHTML = volume_maker.toFixed();
        result_maker.classList.remove('background-green');
        result_maker.classList.add('background-red');
        // console.log('OI уменьшился ', OI);
    }
    //console.log('Maker = ', volume_maker.toFixed());


    if (volume_taker > 0) {  // Maker up

        //get_server_time(message_data_markPrice.E);
        result_taker.innerHTML = volume_taker.toFixed();
        result_taker.classList.remove('background-red');
        result_taker.classList.add('background-green');
        //  console.log('OI увеличился ', OI);
    }
    else if (volume_taker < 0) {  // OI down
        // get_server_time(message_data_markPrice.E);
        result_taker.innerHTML = volume_taker.toFixed();
        result_taker.classList.remove('background-green');
        result_taker.classList.add('background-red');
        // console.log('OI уменьшился ', OI);
    }
    //   console.log('Maker = ', volume_maker.toFixed(), ', Taker = ', volume_taker.toFixed(), ', Price = ', price_bid.toFixed(2), ', Funding-rate = ', funding_rate);

    //   volume_maker = 0;
    //   volume_taker = 0;

}



//ws_bookTicker = new WebSocket('wss://fstream.binance.com/ws/btcusdt@bookTicker');
/*
ws_bookTicker.onopen = () => {
    ws_bookTicker.send(JSON.stringify({
        "method": "SUBSCRIBE",
        "params": [
            "btcusdt@bookTicker"
        ],
        "id": 1
    }));

    if (ws_bookTicker.readyState == 1) {
        // console.log('bookTicker подключен');
    }
}

ws_bookTicker.onmessage = (e_bookTicker) => {
    message_data_bookTicker = JSON.parse(e_bookTicker.data);
    //console.log(message_data_bookTicker);
    if (+message_data_bookTicker.a != prev_price_ask) { price_ask = +message_data_bookTicker.a; console.log('ask = ', price_ask.toFixed(2), ', bid = ', price_bid.toFixed(2)); }
    if (+message_data_bookTicker.b != prev_price_bid) { price_bid = +message_data_bookTicker.b; console.log('ask = ', price_ask.toFixed(2), ', bid = ', price_bid.toFixed(2)); }


    prev_price_ask = price_ask;
    prev_price_bid = price_bid;

    //  console.log('ask = ', price_ask.toFixed(2), ', bid = ', price_bid.toFixed(2));
}
*/
function calc_volume() {
    if (volume > prev_volume && prev_volume != 0) {  // OI up

        //get_server_time(message_data_markPrice.E);
        result_volume.innerHTML = volume.toFixed();
        result_volume.classList.remove('background-red');
        result_volume.classList.add('background-green');
        //  console.log('OI увеличился ', OI);
    }
    else if (volume < prev_volume && prev_volume != 0) {  // OI down
        // get_server_time(message_data_markPrice.E);
        result_volume.innerHTML = volume.toFixed();
        result_volume.classList.remove('background-green');
        result_volume.classList.add('background-red');
        // console.log('OI уменьшился ', OI);
    }

    // console.log('Volume = ', volume.toFixed());

    // console.log('Volume = ', volume.toFixed());

    prev_volume = volume;
    //volume = 0;

}

function calc_price() {

    if (price > prev_price && prev_price != 0) {  // Price up

        // get_server_time(message_data_markPrice.E);
        result_price.innerHTML = price.toFixed(2);
        result_price.classList.remove('background-red');
        result_price.classList.add('background-green');
        // console.log(server_hour, ':', server_minutes, '. Funding rate увеличился ', funding_rate);
    }
    else if (price < prev_price && prev_price != 0) {  // Price down
        //  get_server_time(message_data_markPrice.E);
        result_price.innerHTML = price.toFixed(2);
        result_price.classList.remove('background-green');
        result_price.classList.add('background-red');
        //  console.log(server_hour, ':', server_minutes, '. Funding rate уменьшился ', funding_rate);
    }

    // console.log('Price = ', price.toFixed());
    prev_price = price;

}


// Get Open Interest

async function getOI() {
    try {
        const responce = await fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT');
        const data = await responce.json();
        OI = +data.openInterest;
        // console.log('OI = ', data.openInterest);
        if (OI > prev_OI && prev_OI != 0) {  // OI up

            //get_server_time(message_data_markPrice.E);
            result_OI.innerHTML = OI.toFixed();
            result_OI.classList.remove('background-red');
            result_OI.classList.add('background-green');
            //  console.log('OI увеличился ', OI);
        }
        else if (OI < prev_OI && prev_OI != 0) {  // OI down
            // get_server_time(message_data_markPrice.E);
            result_OI.innerHTML = OI.toFixed();
            result_OI.classList.remove('background-green');
            result_OI.classList.add('background-red');
            // console.log('OI уменьшился ', OI);
        }

        //  console.log('OI = ', OI.toFixed());
        //   console.log('Funding Rate = ', funding_rate);
        //console.log(OI, '. prexv = ', prev_OI);
        prev_OI = OI;
        api_error = false;


    }
    catch (error) {
        console.log('Ошибка API OpenInterest', error);
        api_error = true;
    }
}

if (api_error) { getOI(); }

// setInterval(getOI, 10000);
