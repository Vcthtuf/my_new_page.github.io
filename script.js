//import WebSocket from "ws";


let socket;

let message_data;
let price_bid = 0, price_ask = 0, last_price_bid = 0, last_price_ask = 0;
let BTC_delta_bid = 1000000, BTC_delta_ask = 1000000, ask_max = 0, bid_max = 0;
let server_date = 0, server_hour = 0, server_minute = 0, time_stamp = 0, server_day = 0, server_month = 0;
let buyLimit = 0, sellLimit = 0;
let direction = 'nothing';
let new_connect = false;
let arr_output = [];


let connect = document.querySelector('#connect');
let disconnect = document.querySelector('#disconnect');
let result_connect = document.querySelector('.result_connect');
let output = document.querySelectorAll('.output');
let string_out = '';



function connect_websocket() {
    socket = new WebSocket("wss://stream.bybit.com/v5/public/linear");

    socket.onopen = function (e) {
        console.log("Connect");

        result_connect.textContent = "WebSocket Connect";


        socket.send(JSON.stringify({
            op: "subscribe", args: ["priceLimit.BTCUSDT", "tickers.BTCUSDT"]
        }));
    };

    socket.onerror = function (error) {
        console.log(`[error]`);
    };

    socket.onclose = function (close) {
        console.log('Time = ', server_hour, ':', server_minute, '. Websocket Close');
        new_connect = true;
    }

    socket.onmessage = function (event) {
        // console.log(`Данные получены`);
        message_data = JSON.parse(event.data);

        time_stamp = message_data.ts;

        price_bid = (Object.hasOwn(message_data, 'data') && Object.hasOwn(message_data.data, 'bid1Price') && message_data.data.symbol == 'BTCUSDT') ? +message_data.data.bid1Price : price_bid;
        price_ask = (Object.hasOwn(message_data, 'data') && Object.hasOwn(message_data.data, 'ask1Price') && message_data.data.symbol == 'BTCUSDT') ? +message_data.data.ask1Price : price_ask;

        buyLimit = (Object.hasOwn(message_data, 'data') && Object.hasOwn(message_data.data, 'buyLmt') && message_data.data.symbol == 'BTCUSDT') ? +message_data.data.buyLmt : buyLimit;
        sellLimit = (Object.hasOwn(message_data, 'data') && Object.hasOwn(message_data.data, 'sellLmt') && message_data.data.symbol == 'BTCUSDT') ? +message_data.data.sellLmt : sellLimit;

        BTC_delta_ask = ((buyLimit - price_ask) < BTC_delta_ask) ? buyLimit - price_ask : BTC_delta_ask;
        BTC_delta_bid = ((price_bid - sellLimit) < Math.abs(BTC_delta_bid)) ? price_bid - sellLimit : BTC_delta_bid;

        ask_max = ((buyLimit - price_ask) > ask_max) ? buyLimit - price_ask : ask_max;
        bid_max = ((price_bid - sellLimit) > bid_max) ? price_bid - sellLimit : bid_max;

    };
}

if (new_connect) { connect_websocket(); new_connect = false; }

connect.onclick = connect_websocket;



disconnect.addEventListener('click', function () {

    socket.close(1000);

    console.log('Disconnect');

    result_connect.textContent = "WebSocket Disconnect";


});


let timerId = setInterval(() => {


    server_date = new Date(time_stamp);

    server_month = server_date.getMonth() + 1;
    server_day = server_date.getDate();
    server_hour = server_date.getHours();
    server_minute = server_date.getMinutes();

    if (BTC_delta_ask > BTC_delta_bid && price_bid > last_price_bid) { direction = 'Up'; }
    if (BTC_delta_ask < BTC_delta_bid && price_bid < last_price_bid) { direction = 'Down'; }

    if (BTC_delta_ask < 1000 || BTC_delta_bid < 1000 || BTC_delta_ask - BTC_delta_bid > 50 || BTC_delta_bid - BTC_delta_ask > 50 || direction == 'Up' || direction == 'Down') {

        // console.log('Time: ', server_hour, ':', server_minute, '. BTC: Bid = ', price_bid, ', Delta = ', (BTC_delta_ask - BTC_delta_bid).toFixed(2), ', Direction = ', direction);

        //   console.log('-------------------------------------------------');

        string_out = 'Time: ' + server_hour + ':' + server_minute + '. BTC: Bid = ' + price_bid + ', Delta = ' + (BTC_delta_ask - BTC_delta_bid).toFixed(2) + ', Direction = ' + direction;

        //  console.log(string_out);

        if (arr_output.length < 5) {
            arr_output.push(string_out);
        } else {
            arr_output.shift();
            arr_output.push(string_out);
        }

        for (let i = 0; i < arr_output.length; i++) {
            output[i].textContent = arr_output[i];
        }

    }


    BTC_delta_ask = 1000000; BTC_delta_bid = 1000000;
    bid_max = 0; ask_max = 0;
    last_price_bid = price_bid; last_price_ask = price_ask;
    direction = 'nothing';

}, 60000);

