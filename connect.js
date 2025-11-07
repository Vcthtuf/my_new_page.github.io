const config = {
    binance: {
        wsUrl: 'wss://fstream.binance.com/ws',
        symbol: 'btcusdt',
        pingInterval: 30000,
        reconnectDelay: 5000,
        maxReconnects: 10
    },
    bybit: {
        wsUrl: 'wss://stream.bybit.com/v5/public/linear',
        symbol: 'BTCUSDT',
        pingInterval: 20000,
        reconnectDelay: 5000,
        maxReconnects: 10
    }
};

// Состояние подключений
const state = {
    binance: {
        ws: null,
        pingInterval: null,
        reconnectAttempts: 0,
        isConnected: false,
        messageCount: 0,
        autoReconnect: true
    },
    bybit: {
        ws: null,
        pingInterval: null,
        reconnectAttempts: 0,
        isConnected: false,
        messageCount: 0,
        autoReconnect: true
    }
};

// === СИСТЕМА СОБЫТИЙ ДЛЯ ВНЕШНИХ МОДУЛЕЙ ===
const marketDataEvents = {
    callbacks: {
        binance: {},
        bybit: {}
    },

    on(exchange, eventType, callback) {
        if (!this.callbacks[exchange][eventType]) {
            this.callbacks[exchange][eventType] = [];
        }
        this.callbacks[exchange][eventType].push(callback);
        console.log(`Зарегистрирован обработчик для ${exchange}.${eventType}`);
    },

    emit(exchange, eventType, data) {
        if (this.callbacks[exchange][eventType]) {
            this.callbacks[exchange][eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Ошибка в обработчике ${exchange}.${eventType}:`, error);
                }
            });
        }
    }
};

// Глобально доступный объект
window.MarketData = marketDataEvents;

// === BINANCE ===
function connectBinance() {
    if (state.binance.ws && state.binance.ws.readyState === WebSocket.OPEN) {
        logToPage('binance', 'Уже подключено к Binance');
        return;
    }

    updateStatus('binance', 'connecting', 'Подключение...');
    state.binance.autoReconnect = true;

    try {
        state.binance.ws = new WebSocket(config.binance.wsUrl);

        state.binance.ws.onopen = function () {
            updateStatus('binance', 'connected', 'Подключено');
            state.binance.isConnected = true;
            state.binance.reconnectAttempts = 0;
            logToPage('binance', '✅ WebSocket подключен к Binance Futures');

            // Подписка на trades и funding rate
            subscribeBinanceTrades();
            subscribeBinanceFunding();

            // Запуск пинг-понга
            //  startBinancePing();

            updateReconnectCount('binance', state.binance.reconnectAttempts);
        };

        state.binance.ws.onmessage = function (event) {
            state.binance.messageCount++;
            updateMessageCount('binance', state.binance.messageCount);

            const data = JSON.parse(event.data);

            // Обработка понга
            if (data.pong) {
                logToPage('binance', `📡 Получен PONG: ${data.pong}`);
                return;
            }

            // Обработка funding rate и mark price
            if (data.e === 'markPriceUpdate') {
                const fundingData = {
                    exchange: 'binance',
                    symbol: data.s,
                    markPrice: parseFloat(data.p),
                    fundingRate: parseFloat(data.r),
                    nextFundingTime: data.T,
                    timestamp: data.E,
                    eventType: 'mark_price'
                };
                window.MarketData.emit('binance', 'funding_rate', fundingData);

                if (state.binance.messageCount <= 3) {
                    logToPage('binance', `💰 Mark Price: ${data.p}, Funding Rate: ${data.r}`);
                }
            }

            // Обработка трейдов
            if (data.e === 'trade') {
                const tradeData = {
                    exchange: 'binance',
                    symbol: data.s,
                    price: parseFloat(data.p),
                    quantity: parseFloat(data.q),
                    timestamp: data.T,
                    isBuyerMaker: data.m
                };
                window.MarketData.emit('binance', 'trade', tradeData);

                if (state.binance.messageCount <= 5) {
                    logToPage('binance', `🎯 Trade: ${data.p} x ${data.q}`);
                }
            }

            // Логируем только первые несколько сообщений чтобы не засорять вывод
            if (state.binance.messageCount <= 5) {
                logToPage('binance', `📨 ${data.e}: ${JSON.stringify(data)}`);
            } else if (state.binance.messageCount === 6) {
                logToPage('binance', '... данные продолжают поступать ...');
            }
        };

        state.binance.ws.onclose = function (event) {
            updateStatus('binance', 'disconnected', 'Отключено');
            state.binance.isConnected = false;
            logToPage('binance', `❌ Соединение закрыто: ${event.code} ${event.reason}`);

            //stopBinancePing();

            // Автоматическое переподключение
            if (state.binance.autoReconnect && state.binance.reconnectAttempts < config.binance.maxReconnects) {
                state.binance.reconnectAttempts++;
                logToPage('binance', `🔄 Переподключение через ${config.binance.reconnectDelay / 1000}сек... (попытка ${state.binance.reconnectAttempts})`);
                updateReconnectCount('binance', state.binance.reconnectAttempts);

                setTimeout(() => {
                    connectBinance();
                }, config.binance.reconnectDelay);
            }
        };

        state.binance.ws.onerror = function (error) {
            logToPage('binance', `❌ Ошибка WebSocket: ${error}`);
        };

    } catch (error) {
        logToPage('binance', `❌ Ошибка подключения: ${error}`);
        updateStatus('binance', 'disconnected', 'Ошибка подключения');
    }
}

function subscribeBinanceTrades() {
    const subscribeMsg = {
        method: "SUBSCRIBE",
        params: [
            `${config.binance.symbol}@trade`
        ],
        id: 1
    };
    state.binance.ws.send(JSON.stringify(subscribeMsg));
    logToPage('binance', `📢 Подписан на ${config.binance.symbol}@trade`);
}

function subscribeBinanceFunding() {
    const subscribeMsg = {
        method: "SUBSCRIBE",
        params: [
            `${config.binance.symbol}@markPrice@1s`
        ],
        id: 2
    };
    state.binance.ws.send(JSON.stringify(subscribeMsg));
    logToPage('binance', `📢 Подписан на funding rate для ${config.binance.symbol}`);
}

function startBinancePing() {
    state.binance.pingInterval = setInterval(() => {
        if (state.binance.ws && state.binance.ws.readyState === WebSocket.OPEN) {
            const pingMsg = {
                method: "PING"
            };
            state.binance.ws.send(JSON.stringify(pingMsg));
            logToPage('binance', '📤 Отправлен PING');
        }
    }, config.binance.pingInterval);
}

function stopBinancePing() {
    if (state.binance.pingInterval) {
        clearInterval(state.binance.pingInterval);
        state.binance.pingInterval = null;
    }
}

function disconnectBinance() {
    state.binance.autoReconnect = false;
    stopBinancePing();

    if (state.binance.ws) {
        // Отписка
        const unsubscribeMsg = {
            method: "UNSUBSCRIBE",
            params: [
                `${config.binance.symbol}@trade`,
                `${config.binance.symbol}@markPrice@1s`
            ],
            id: 1
        };
        state.binance.ws.send(JSON.stringify(unsubscribeMsg));

        state.binance.ws.close(1000, 'Manual disconnect');
        state.binance.ws = null;
    }

    updateStatus('binance', 'disconnected', 'Отключено вручную');
    logToPage('binance', '⏹️ Принудительное отключение');
}

// === BYBIT ===
function connectBybit() {
    if (state.bybit.ws && state.bybit.ws.readyState === WebSocket.OPEN) {
        logToPage('bybit', 'Уже подключено к Bybit');
        return;
    }

    updateStatus('bybit', 'connecting', 'Подключение...');
    state.bybit.autoReconnect = true;

    try {
        state.bybit.ws = new WebSocket(config.bybit.wsUrl);

        state.bybit.ws.onopen = function () {
            updateStatus('bybit', 'connected', 'Подключено');
            state.bybit.isConnected = true;
            state.bybit.reconnectAttempts = 0;
            logToPage('bybit', '✅ WebSocket подключен к Bybit Futures');

            // Подписка на trades и funding
            subscribeBybitTrades();
            subscribeBybitFunding();

            // Запуск пинг-понга
            //startBybitPing();

            updateReconnectCount('bybit', state.bybit.reconnectAttempts);
        };

        state.bybit.ws.onmessage = function (event) {
            state.bybit.messageCount++;
            updateMessageCount('bybit', state.bybit.messageCount);

            const data = JSON.parse(event.data);

            // Обработка понга
            if (data.op === 'pong') {
                logToPage('bybit', `📡 Получен PONG: ${JSON.stringify(data)}`);
                return;
            }

            // Обработка funding rate
            if (data.topic && data.topic.includes('funding')) {
                const fundingData = {
                    exchange: 'bybit',
                    symbol: data.data[0].symbol,
                    fundingRate: parseFloat(data.data[0].fundingRate),
                    timestamp: data.ts,
                    eventType: 'funding_rate'
                };
                window.MarketData.emit('bybit', 'funding_rate', fundingData);

                if (state.bybit.messageCount <= 3) {
                    logToPage('bybit', `💰 Funding Rate: ${data.data[0].fundingRate}`);
                }
            }

            // Обработка mark price
            if (data.topic && data.topic.includes('markPrice')) {
                const markPriceData = {
                    exchange: 'bybit',
                    symbol: data.data.symbol,
                    markPrice: parseFloat(data.data.markPrice),
                    timestamp: data.ts,
                    eventType: 'mark_price'
                };
                window.MarketData.emit('bybit', 'mark_price', markPriceData);
            }

            // Обработка трейдов
            if (data.topic && data.topic.includes('publicTrade')) {
                data.data.forEach(trade => {
                    const tradeData = {
                        exchange: 'bybit',
                        symbol: trade.s,
                        price: parseFloat(trade.p),
                        quantity: parseFloat(trade.v),
                        timestamp: trade.T,
                        side: trade.S
                    };
                    window.MarketData.emit('bybit', 'trade', tradeData);
                });

                if (state.bybit.messageCount <= 5) {
                    logToPage('bybit', `🎯 Trade: ${data.data.length} trades`);
                }
            }

            // Логируем только первые несколько сообщений
            if (state.bybit.messageCount <= 5) {
                logToPage('bybit', `📨 ${data.topic || 'data'}: ${JSON.stringify(data).substring(0, 100)}...`);
            } else if (state.bybit.messageCount === 6) {
                logToPage('bybit', '... данные продолжают поступать ...');
            }
        };

        state.bybit.ws.onclose = function (event) {
            updateStatus('bybit', 'disconnected', 'Отключено');
            state.bybit.isConnected = false;
            logToPage('bybit', `❌ Соединение закрыто: ${event.code} ${event.reason}`);

            // stopBybitPing();

            // Автоматическое переподключение
            if (state.bybit.autoReconnect && state.bybit.reconnectAttempts < config.bybit.maxReconnects) {
                state.bybit.reconnectAttempts++;
                logToPage('bybit', `🔄 Переподключение через ${config.bybit.reconnectDelay / 1000}сек... (попытка ${state.bybit.reconnectAttempts})`);
                updateReconnectCount('bybit', state.bybit.reconnectAttempts);

                setTimeout(() => {
                    connectBybit();
                }, config.bybit.reconnectDelay);
            }
        };

        state.bybit.ws.onerror = function (error) {
            logToPage('bybit', `❌ Ошибка WebSocket: ${error}`);
        };

    } catch (error) {
        logToPage('bybit', `❌ Ошибка подключения: ${error}`);
        updateStatus('bybit', 'disconnected', 'Ошибка подключения');
    }
}

function subscribeBybitTrades() {
    const subscribeMsg = {
        op: "subscribe",
        args: [
            `publicTrade.${config.bybit.symbol}`
        ]
    };
    state.bybit.ws.send(JSON.stringify(subscribeMsg));
    logToPage('bybit', `📢 Подписан на publicTrade.${config.bybit.symbol}`);
}

function subscribeBybitFunding() {
    const subscribeMsg = {
        op: "subscribe",
        args: [
            `funding.${config.bybit.symbol}`
        ]
    };
    state.bybit.ws.send(JSON.stringify(subscribeMsg));
    logToPage('bybit', `📢 Подписан на funding.${config.bybit.symbol}`);
}

function startBybitPing() {
    state.bybit.pingInterval = setInterval(() => {
        if (state.bybit.ws && state.bybit.ws.readyState === WebSocket.OPEN) {
            const pingMsg = {
                op: "ping"
            };
            state.bybit.ws.send(JSON.stringify(pingMsg));
            logToPage('bybit', '📤 Отправлен PING');
        }
    }, config.bybit.pingInterval);
}

function stopBybitPing() {
    if (state.bybit.pingInterval) {
        clearInterval(state.bybit.pingInterval);
        state.bybit.pingInterval = null;
    }
}

function disconnectBybit() {
    state.bybit.autoReconnect = false;
    stopBybitPing();

    if (state.bybit.ws) {
        // Отписка
        const unsubscribeMsg = {
            op: "unsubscribe",
            args: [
                `publicTrade.${config.bybit.symbol}`,
                `funding.${config.bybit.symbol}`
            ]
        };
        state.bybit.ws.send(JSON.stringify(unsubscribeMsg));

        state.bybit.ws.close(1000, 'Manual disconnect');
        state.bybit.ws = null;
    }

    updateStatus('bybit', 'disconnected', 'Отключено вручную');
    logToPage('bybit', '⏹️ Принудительное отключение');
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function logToPage(exchange, message) {
    const output = document.getElementById(`${exchange}-output`);
    const timestamp = new Date().toLocaleTimeString();
    output.innerHTML += `[${timestamp}] ${message}\n`;
    output.scrollTop = output.scrollHeight;

    // Также выводим в консоль браузера
    console.log(`[${exchange.toUpperCase()}] ${message}`);
}

function updateStatus(exchange, status, text) {
    const statusElement = document.getElementById(`${exchange}-status`);
    statusElement.textContent = text;
    statusElement.className = status;
}

function updateReconnectCount(exchange, count) {
    document.getElementById(`${exchange}-reconnects`).textContent = count;
}

function updateMessageCount(exchange, count) {
    document.getElementById(`${exchange}-message-count`).textContent = count;
}

// Автоподключение при загрузке
window.addEventListener('load', function () {
    logToPage('binance', '🚀 Готов к подключению к Binance Futures');
    logToPage('bybit', '🚀 Готов к подключению к Bybit Futures');

    // Автоматическое подключение (раскомментируйте если нужно)
    setTimeout(() => {
        connectBinance();
        connectBybit();
    }, 1000);
});

// Обработка закрытия страницы
window.addEventListener('beforeunload', function () {
    disconnectBinance();
    disconnectBybit();
});
